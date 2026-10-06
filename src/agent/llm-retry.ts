const RATE_LIMIT_MAX_ATTEMPTS = 3;
const RATE_LIMIT_MAX_WAIT_MS = 45_000;
const RATE_LIMIT_DEFAULT_WAIT_MS = 5_000;

// Um 429 que pede mais de 90s nunca e transitario: e cota diaria (TPD/RPD) ou
// janela longa. Retentar dentro do mesmo request so desperdica tokens.
const LONG_WAIT_THRESHOLD_MS = 90_000;
const UNPARSEABLE_QUOTA_COOLDOWN_MS = 60 * 60 * 1000;

const QUOTA_EXHAUSTED_RE =
  /tokens per day|\bTPD\b|requests per day|\bRPD\b|quota (?:exceeded|is exhausted)|current quota|quotaValue|RESOURCE_EXHAUSTED|per[- ]day (?:quota|limit)|daily (?:quota|limit)/i;

const RATE_LIMIT_RE =
  /rate.?limit|\b429\b|too many requests|RESOURCE_EXHAUSTED|tokens per day|daily prompt tokens|quotas? (?:exceeded|is exhausted)|per[- ]day quota|daily quota|tokens limit/i;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const SUFFIXED_DURATION_RE =
  /\b(?:in|after|delay)\s+((?:\d+\.?\d*\s*h)?\s*(?:\d+\.?\d*\s*m)?\s*\d+\.?\d*\s*s)\b/i;

const QUOTED_DELAY_RE = /"retryDelay"\s*:\s*"([^"]+)"/i;

const BARE_DURATION_RE =
  /\b((?:\d+\.?\d*\s*h)?\s*(?:\d+\.?\d*\s*m)?\s*\d+\.?\d*\s*s)\b/i;

function normalizeDuration(raw: string): string {
  return raw.replace(/\s+/g, '');
}

function durationToMs(raw: string): number | undefined {
  const text = normalizeDuration(raw);
  const match =
    /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?))?s$/.exec(
      text,
    );
  if (!match || text === 's') return undefined;

  const [, hours, minutes, seconds] = match;
  const ms =
    (Number(hours ?? 0) * 3600 +
      Number(minutes ?? 0) * 60 +
      Number(seconds ?? 0)) *
    1000;

  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

function readRetryAfterHeader(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const source = error as Record<string, unknown>;
  const candidates = [source, source.response]
    .map((scope) => {
      if (!scope || typeof scope !== 'object') return undefined;
      const holder = scope as { headers?: unknown };
      return holder.headers;
    })
    .filter((headers): headers is Record<string, unknown> => !!headers);

  for (const headers of candidates) {
    const raw: unknown =
      typeof headers.get === 'function'
        ? (headers.get as (key: string) => unknown).call(headers, 'retry-after')
        : (headers['retry-after'] ?? headers['Retry-After']);

    if (raw == null || typeof raw !== 'string') continue;

    const seconds = Number(raw);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const date = Date.parse(raw);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }

  return undefined;
}

/**
 * Extrai o tempo de espera de um 429 sem definir. Cobre os formatos reais:
 * "try again in 15m46.944s", "retry in 1h49m29.823271593s", "6569s",
 * `errorDetails[].retryDelay` e o header `Retry-After`.
 */
export function parseWaitMs(error: unknown): number | undefined {
  const message = getErrorMessage(error);

  for (const pattern of [
    SUFFIXED_DURATION_RE,
    QUOTED_DELAY_RE,
    BARE_DURATION_RE,
  ]) {
    const match = pattern.exec(message);
    if (!match) continue;
    const ms = durationToMs(match[1]);
    if (ms !== undefined) return ms;
  }

  return readRetryAfterHeader(error);
}

export function getRetryDelayMs(error: unknown): number {
  const parsed = parseWaitMs(error);
  if (parsed === undefined) return RATE_LIMIT_DEFAULT_WAIT_MS;
  return Math.min(parsed, RATE_LIMIT_MAX_WAIT_MS);
}

export function isRateLimitError(error: unknown): boolean {
  return RATE_LIMIT_RE.test(getErrorMessage(error));
}

/**
 * Distingue 429 transitorio (RPM/TPM, recupera em segundos) de cota
 * diaria (TPD/RPD, so volta em dezenas de minutos ou na proxima meia-noite).
 */
export function isQuotaExhaustedError(error: unknown): boolean {
  if (error instanceof QuotaExhaustedError) return true;
  if (QUOTA_EXHAUSTED_RE.test(getErrorMessage(error))) return true;
  const wait = parseWaitMs(error);
  return wait !== undefined && wait > LONG_WAIT_THRESHOLD_MS;
}

export interface ModelCooldown {
  until: number;
  reason: string;
}

const cooldowns = new Map<string, ModelCooldown>();

function liveCooldown(modelId: string): ModelCooldown | undefined {
  const entry = cooldowns.get(modelId);
  if (!entry) return undefined;
  if (entry.until <= Date.now()) {
    cooldowns.delete(modelId);
    return undefined;
  }
  return entry;
}

export function markModelUnavailable(modelId: string, error?: unknown): number {
  const parsed = error === undefined ? undefined : parseWaitMs(error);
  const until = Date.now() + (parsed ?? UNPARSEABLE_QUOTA_COOLDOWN_MS);

  // Nunca encurta um cooldown ja registrado: pode ser uma estimativa imprecisa
  // sobrescrevendo o tempo real retornado pelo provedor.
  const existing = liveCooldown(modelId);
  if (existing && existing.until >= until) return existing.until;

  const reason =
    error === undefined
      ? 'cota diaria esgotada'
      : getErrorMessage(error).split('\n')[0].slice(0, 200);

  cooldowns.set(modelId, { until, reason });
  return until;
}

export function isModelCoolingDown(modelId: string): boolean {
  return liveCooldown(modelId) !== undefined;
}

export function getCooldown(modelId: string): ModelCooldown | undefined {
  return liveCooldown(modelId);
}

export function getEarliestResetAt(modelIds: string[]): number | undefined {
  let earliest: number | undefined;
  for (const modelId of modelIds) {
    const entry = liveCooldown(modelId);
    if (!entry) return undefined;
    if (earliest === undefined || entry.until < earliest)
      earliest = entry.until;
  }
  return earliest;
}

export function clearCooldowns(): void {
  cooldowns.clear();
}

export function formatRetryDelay(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}min`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.join(' ') || 'instantes';
}

export class AllProvidersCoolingDownError extends Error {
  readonly nextAvailableAt: number;

  constructor(modelIds: string[], nextAvailableAt: number) {
    super(
      `Todos os modelos de IA atingiram o limite diario. Tente novamente em ${formatRetryDelay(
        nextAvailableAt - Date.now(),
      )}.`,
    );
    this.name = 'AllProvidersCoolingDownError';
    this.nextAvailableAt = nextAvailableAt;
  }
}

export class QuotaExhaustedError extends Error {
  readonly modelId: string;
  readonly retryAt: number;

  constructor(modelId: string, reason: string, retryAt: number) {
    super(
      `Modelo ${modelId} sem cotas disponiveis: ${reason}. Volta em ${formatRetryDelay(retryAt - Date.now())}.`,
    );
    this.name = 'QuotaExhaustedError';
    this.modelId = modelId;
    this.retryAt = retryAt;
  }
}

export function isQuotaError(error: unknown): boolean {
  return (
    error instanceof AllProvidersCoolingDownError ||
    error instanceof QuotaExhaustedError ||
    isQuotaExhaustedError(error)
  );
}

export async function runWithRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; modelId?: string } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? RATE_LIMIT_MAX_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error)) throw error;

      // Cota diaria nao volta em 45s: marca o cooldown e sai logo.
      if (isQuotaExhaustedError(error)) {
        const reason = getErrorMessage(error).split('\n')[0].slice(0, 200);
        if (!options.modelId) throw error;

        const until = markModelUnavailable(options.modelId, error);
        throw new QuotaExhaustedError(options.modelId, reason, until);
      }

      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, getRetryDelayMs(error)),
      );
    }
  }

  throw lastError;
}

export interface FallbackResult<T> {
  modelId: string;
  value: T;
}

/**
 * Executa `invoke` na ordem de `modelIds`, pulando quem esta em cooldown,
 * respeitando rate limit transititorio e registrando cooldown em cota diaria.
 */
export async function invokeWithFallback<T>(
  modelIds: string[],
  invoke: (modelId: string) => Promise<T>,
  isAllowed: (modelId: string) => boolean = () => true,
): Promise<FallbackResult<T>> {
  const candidates = modelIds.filter(
    (modelId, index) =>
      !!modelId && isAllowed(modelId) && modelIds.indexOf(modelId) === index,
  );

  const ready = candidates.filter((modelId) => !isModelCoolingDown(modelId));

  if (!ready.length) {
    if (!candidates.length) {
      throw new Error('Nenhum modelo de IA disponivel para esta operacao.');
    }

    const next = getEarliestResetAt(candidates);
    if (next === undefined) throw new Error('Modelos de IA indisponiveis.');

    throw new AllProvidersCoolingDownError(candidates, next);
  }

  let lastError: unknown;
  for (const modelId of ready) {
    try {
      const value = await runWithRateLimitRetry(() => invoke(modelId), {
        modelId,
      });
      return { modelId, value };
    } catch (error) {
      lastError = error;

      // QuotaExhaustedError ja marcou o cooldown com o tempo preciso do provedor.
      if (
        !(error instanceof QuotaExhaustedError) &&
        isQuotaExhaustedError(error)
      ) {
        markModelUnavailable(modelId, error);
      }

      console.warn(
        `Modelo ${modelId} falhou: ${getErrorMessage(error).slice(0, 300)}`,
      );
    }
  }

  // Todos os candidatos que sobraram cairiam em cooldown: adianta nova tentativa.
  const next = getEarliestResetAt(ready);
  if (next !== undefined) {
    throw new AllProvidersCoolingDownError(ready, next);
  }

  throw lastError;
}

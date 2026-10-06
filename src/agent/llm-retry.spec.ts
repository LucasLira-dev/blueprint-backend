import {
  parseWaitMs,
  getRetryDelayMs,
  isRateLimitError,
  isQuotaExhaustedError,
  isQuotaError,
  runWithRateLimitRetry,
  invokeWithFallback,
  markModelUnavailable,
  isModelCoolingDown,
  clearCooldowns,
  AllProvidersCoolingDownError,
  QuotaExhaustedError,
} from './llm-retry';

const QUOTA_MESSAGES = [
  'You have hit the daily prompt tokens limit (202500). Please try again in 15m46.944s.',
  'You exceeded your current quota, please check your plan and billing details.',
  'Error 429: Daily limit exceeded. quotaValue=1000, quotaProject=...',
  'Tokens per day (TPD) quota exceeded: 200000. Retry-After: 6569',
];

describe('llm-retry', () => {
  beforeEach(() => clearCooldowns());

  describe('parseWaitMs / getRetryDelayMs', () => {
    it('parseia "in 15m46.944s"', () => {
      expect(parseWaitMs(new Error(QUOTA_MESSAGES[0]))).toBeCloseTo(
        (15 * 60 + 46.944) * 1000,
        0,
      );
    });

    it('parseia "in 1h49m29.823271593s"', () => {
      expect(parseWaitMs(new Error('retry in 1h49m29.823271593s'))).toBeCloseTo(
        (1 * 3600 + 49 * 60 + 29.823) * 1000,
        0,
      );
    });

    it('parseia duracao nua "6569s"', () => {
      expect(parseWaitMs(new Error('quota exceeded 6569s'))).toBe(6_569_000);
    });

    it('parseia "after 8m59s"', () => {
      expect(parseWaitMs(new Error('try after 8m59s'))).toBe(
        (8 * 60 + 59) * 1000,
      );
    });

    it('parseia retryDelay entre aspas', () => {
      const raw = { errorDetails: [{ retryDelay: '6569s' }] };
      expect(parseWaitMs(new Error(JSON.stringify(raw)))).toBe(6_569_000);
    });

    it('usa o header Retry-After', () => {
      const error = {
        response: {
          headers: {
            get: (name: string) =>
              name === 'retry-after' ? '6569' : undefined,
          },
        },
      };
      expect(parseWaitMs(error)).toBe(6_569_000);
    });

    it('sem tempo conhecido usa o default de 5s', () => {
      expect(getRetryDelayMs(new Error('rate limit'))).toBe(5_000);
    });

    it('nunca retenta mais que 45s dentro do mesmo request', () => {
      expect(getRetryDelayMs(new Error('in 2h30m30s'))).toBe(45_000);
    });
  });

  describe('isQuotaExhaustedError', () => {
    it.each(QUOTA_MESSAGES)('detecta cota diaria em: %s', (msg) => {
      expect(isQuotaExhaustedError(new Error(msg))).toBe(true);
    });

    it('distingue 429 transitorio (RPM/TPM)', () => {
      expect(
        isQuotaExhaustedError(new Error('rate limit reached, try again in 3s')),
      ).toBe(false);
    });

    it('considera espera longa como cota', () => {
      expect(isQuotaExhaustedError(new Error('try again in 1h2m3s'))).toBe(
        true,
      );
    });
  });

  describe('isRateLimitError', () => {
    it('detecta 429 generico', () => {
      expect(
        isRateLimitError(new Error('status: 429, too many requests')),
      ).toBe(true);
    });

    it('devolve false para erro de negocio', () => {
      expect(isRateLimitError(new Error('schema validation failed'))).toBe(
        false,
      );
    });
  });

  describe('cooldown registry', () => {
    it('marca modelo indisponivel e expira', () => {
      const until = markModelUnavailable('groq/a', new Error('in 1h'));
      expect(isModelCoolingDown('groq/a')).toBe(true);
      expect(until).toBeGreaterThan(Date.now());
      clearCooldowns();
      expect(isModelCoolingDown('groq/a')).toBe(false);
    });

    it('nao encurta cooldown ja registrado', () => {
      markModelUnavailable('groq/a', new Error('in 1h'));
      const before = markModelUnavailable('groq/a', new Error('in 5s'));
      expect(before).toBeGreaterThan(Date.now() + 59 * 60 * 1000);
    });
  });

  describe('runWithRateLimitRetry', () => {
    it('retenta 429 transitorio', async () => {
      let calls = 0;
      const fn = jest.fn(() => {
        calls++;
        if (calls < 3) return Promise.reject(new Error('429 too many, in 1s'));
        return Promise.resolve('ok');
      });

      await expect(runWithRateLimitRetry(fn)).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('lanca QuotaExhaustedError e marca cooldown em cota diaria', async () => {
      const fn = jest.fn(() => Promise.reject(new Error(QUOTA_MESSAGES[0])));

      await expect(
        runWithRateLimitRetry(fn, { modelId: 'groq/a' }),
      ).rejects.toBeInstanceOf(QuotaExhaustedError);
      expect(isModelCoolingDown('groq/a')).toBe(true);
    });

    it('propaga erro nao relacionado a rate limit', async () => {
      const fn = jest.fn(() =>
        Promise.reject(new Error('topics schema invalid')),
      );

      await expect(runWithRateLimitRetry(fn)).rejects.toThrow(
        'topics schema invalid',
      );
    });
  });

  describe('invokeWithFallback', () => {
    it('pula modelos em cooldown e usa o primeiro disponivel', async () => {
      markModelUnavailable('a', new Error('in 1h'));
      const invoke = jest.fn((modelId: string) =>
        modelId === 'b'
          ? Promise.resolve(`ok-${modelId}`)
          : Promise.reject(new Error('nunca chamado')),
      );

      await expect(invokeWithFallback(['a', 'b'], invoke)).resolves.toEqual({
        modelId: 'b',
        value: 'ok-b',
      });
      expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('lanca AllProvidersCoolingDownError quando todos esgotam', async () => {
      markModelUnavailable('a', new Error('in 1h'));
      markModelUnavailable('b', new Error('in 1h'));

      await expect(
        invokeWithFallback(['a', 'b'], jest.fn()),
      ).rejects.toBeInstanceOf(AllProvidersCoolingDownError);
    });

    it('cai para o proximo modelo quando o anterior estoura cota', async () => {
      const invoke = jest.fn((modelId: string) =>
        modelId === 'a'
          ? Promise.reject(new Error(QUOTA_MESSAGES[0]))
          : Promise.resolve(`ok-${modelId}`),
      );

      await expect(invokeWithFallback(['a', 'b'], invoke)).resolves.toEqual({
        modelId: 'b',
        value: 'ok-b',
      });
      expect(isModelCoolingDown('a')).toBe(true);
      expect(isModelCoolingDown('b')).toBe(false);
    });
  });

  describe('isQuotaError', () => {
    it('reconhece as classes customizadas e mensagens de cota', () => {
      expect(
        isQuotaError(new AllProvidersCoolingDownError(['a'], Date.now() + 1)),
      ).toBe(true);
      expect(
        isQuotaError(new QuotaExhaustedError('a', 'r', Date.now() + 1)),
      ).toBe(true);
      expect(isQuotaError(new Error(QUOTA_MESSAGES[0]))).toBe(true);
      expect(isQuotaError(new Error('boom generico'))).toBe(false);
    });
  });
});

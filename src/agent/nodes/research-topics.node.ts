import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { DeepLearningStateType } from '../state/deep-learning.state';
import {
  buildResearchAgent,
  FALLBACK_RESEARCH_MODEL,
  RESEARCH_MODEL,
} from '../subagents/research/research.agent';
import { getLlm } from '../llm.factory';
import { researchResultSchema } from '../schemas/researchSchema';

const FORMATTER_SYSTEM_PROMPT = `
Você é um editor de pesquisa do Blueprint, responsável por transformar a saída em texto livre do
agente de pesquisa em dados JSON estruturados, limpos e fiéis às fontes.

## Regra de saída
Responda SOMENTE com um JSON válido, sem texto antes ou depois, no formato exato:

{
  "results": [
    {
      "topicId": "string",
      "title": "string",
      "summary": "string",
      "keyPoints": ["string"],
      "sources": [{ "title": "string", "url": "string" }]
    }
  ],
  "researchStatus": "success" | "degraded" | "failed"
}

## Regras de estrutura
- results: um objeto por subtópico pesquisado.
- topicId: deve ser exatamente o id (slug) do subtópico correspondente quando ele aparecer no
  texto da pesquisa; caso contrário, gere um slug curto e coeso a partir do título.
- title: nome curto e canônico do subtópico.
- summary: síntese objetiva (2 a 4 frases) do que o subtópico cobre e por que importa na jornada
  de aprendizado do aluno.
- keyPoints: de 3 a 6 pontos-chave acionáveis (conceitos, definições, técnicas, erros comuns),
  cada um em uma frase curta.
- sources: de 1 a 4 fontes reais citadas na pesquisa, com url completa e válida e title da fonte
  ou domínio.
- researchStatus: o status da pesquisa, que pode ser "success", "degraded" ou "failed".

## Regras de integridade
- NUNCA invente URLs, títulos ou conteúdo. Extraia apenas o que está presente no texto da pesquisa
  e mantenha apenas as fontes que realmente foram citadas.
- Se a pesquisa não trouxe fonte para um subtópico, use sources: [] em vez de fabricar uma.
- Não adicione informações que não constem no texto fornecido. Se o texto indicar que um subtópico
  não pôde ser pesquisado, preserve o objeto com summary descrevendo a pendência e sources: [].
`;

function extractResearchText(agentResult: unknown): string {
  const results = agentResult as { messages?: Array<{ content?: unknown }> };
  const messages = results.messages ?? [];
  const last = messages[messages.length - 1];
  if (!last) return '';

  const content = last.content;
  console.log('Research agent output:', content);
  return typeof content === 'string'
    ? content
    : JSON.stringify(content, null, 2);
}

export function buildResearchTopicsNode() {
  return async (
    state: DeepLearningStateType,
    config: LangGraphRunnableConfig,
  ) => {
    config.writer?.({
      step: 'researchTopics',
      status: 'start',
      label: 'Pesquisando os tópicos do aprendizado...',
    });

    const agentResult = await runResearchAgent(
      {
        messages: [
          {
            role: 'user',
            content: `
            Tema:
            ${state.topic}

            Syllabus:
            ${state.syllabus}

            Subtópicos:
            ${JSON.stringify(state.topics)}
        `,
          },
        ],
      },
      state.model,
    );

    const researchText = extractResearchText(agentResult).slice(0, 120_000);

    console.log({
      topicCount: state.topics.length,
      topics: state.topics,
      researchTextLength: researchText.length,
      researchText: researchText.slice(0, 2000),
    });

    const formattedResults = await formatResearch(state.model, researchText);

    const label =
      formattedResults.researchStatus === 'success'
        ? 'Pesquisa concluída com sucesso.'
        : 'Pesquisa indisponível; conteúdo será gerado com base na syllabus.';

    config.writer?.({
      step: 'researchTopics',
      status: 'done',
      label: label,
    });

    return {
      researchResults: formattedResults.results,
      researchStatus: formattedResults.researchStatus,
    };
  };
}

const FALLBACK_FORMATTER_MODEL = 'openai/gpt-oss-120b';

const GROQ_MAX_ATTEMPTS = 3;
const GROQ_MAX_WAIT_MS = 45_000;

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /rate.?limit|\b429\b/i.test(message);
}

function getRetryDelayMs(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const seconds = message.match(/try again in ([\d.]+)s/i)?.[1];
  if (!seconds) return 5_000;
  return Math.min(Math.ceil(Number(seconds) * 1000) + 1_000, GROQ_MAX_WAIT_MS);
}

async function runWithGroqRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === GROQ_MAX_ATTEMPTS)
        throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, getRetryDelayMs(error)),
      );
    }
  }

  throw lastError;
}

async function runResearchAgent(input: unknown, modelId: string) {
  const run = (id: string) => buildResearchAgent(id).invoke(input as never);

  try {
    return await runWithGroqRetry(() => run(RESEARCH_MODEL));
  } catch {
    // Rate limit persistente ou falha do modelo Groq: tenta o modelo escolhido
    // pelo usuario e, por ultimo, o Gemini.
    const fallbacks =
      modelId === RESEARCH_MODEL || modelId === FALLBACK_RESEARCH_MODEL
        ? [FALLBACK_RESEARCH_MODEL]
        : [modelId, FALLBACK_RESEARCH_MODEL];

    let lastError: unknown;
    for (const id of fallbacks) {
      try {
        return await run(id);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}

async function formatResearch(modelId: string, researchText: string) {
  const prompt = `
      ${FORMATTER_SYSTEM_PROMPT}

      Texto da pesquisa:
      """
      ${researchText}
      """
    `;

  try {
    const model = getLlm(modelId);
    const formatter = model.withStructuredOutput(researchResultSchema, {});
    return await formatter.invoke(prompt);
  } catch {
    const model = getLlm(FALLBACK_FORMATTER_MODEL);
    const formatter = model.withStructuredOutput(researchResultSchema, {});
    return await formatter.invoke(prompt);
  }
}

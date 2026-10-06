import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { DeepLearningStateType } from '../state/deep-learning.state';
import {
  buildResearchAgent,
  FALLBACK_RESEARCH_MODEL,
  RESEARCH_MODEL,
} from '../subagents/research/research.agent';
import {
  DEFAULT_MODEL,
  RESEARCH_MODELS,
  getLlm,
  isModelAllowed,
} from '../llm.factory';
import { invokeWithFallback } from '../llm-retry';
import { researchResultSchema } from '../schemas/researchSchema';

// 120k chars (~30k tokens) era input puro numa chamada que so precisa de JSON.
// Com pesquisa vazia ou curta a entrada cai junto.
const MAX_RESEARCH_CHARS = 48_000;

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

interface ContentLikeMessage {
  content?: unknown;
}

function toText(content: unknown): string {
  if (typeof content === 'string') return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (!block || typeof block !== 'object') return '';
        const value = block as { type?: string; text?: unknown };
        return typeof value.text === 'string' ? value.text : '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

/**
 * Varre as mensagens de tras para frente atras do ultimo texto nao vazio.
 * O agente de pesquisa termina com tool calls sem conteudo quando o loop
 * estoura, e olhar so a ultima mensagem devolvia `[]`.
 */
function extractResearchText(agentResult: unknown): string {
  const results = agentResult as { messages?: ContentLikeMessage[] };
  const messages = results.messages ?? [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const text = toText(messages[i]?.content);
    if (text) return text;
  }

  if (messages.length) {
    const summary = messages.map((message, index) => {
      const content = message.content;
      const preview =
        typeof content === 'string'
          ? content.slice(0, 80)
          : (JSON.stringify(content)?.slice(0, 80) ?? typeof content);
      return `#${index} type=${typeof content}: ${preview}`;
    });
    console.warn('Pesquisa sem texto utilizavel. Mensagens:', summary);
  } else {
    console.warn('Pesquisa sem texto utilizavel: nenhuma mensagem retornada.');
  }

  return '';
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

    const researchText = extractResearchText(agentResult).slice(
      0,
      MAX_RESEARCH_CHARS,
    );

    console.log({
      topicCount: state.topics.length,
      researchTextLength: researchText.length,
      researchPreview: researchText.slice(0, 500),
    });

    // Sem texto nao vale a pena chamar o formatter: seria uma request inteira
    // para um modelo transformar `[]` em JSON. O conteudo sai da syllabus.
    if (!researchText.trim()) {
      console.warn('Pesquisa vazia; seguindo apenas com a syllabus.');

      config.writer?.({
        step: 'researchTopics',
        status: 'done',
        label:
          'Pesquisa indisponível; conteúdo será gerado com base na syllabus.',
      });

      return {
        researchResults: [],
        researchStatus: 'failed' as const,
      };
    }

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

async function runResearchAgent(input: unknown, modelId: string) {
  // Recursion limit explícito: sem ele o loop de tool calls pode devorar
  // a cota diaria do modelo inteira antes de produzir qualquer texto.
  const RESEARCH_RECURSION_LIMIT = 15;

  const run = (id: string) =>
    buildResearchAgent(id).invoke(input as never, {
      recursionLimit: RESEARCH_RECURSION_LIMIT,
    });

  try {
    const result = await invokeWithFallback(
      [
        RESEARCH_MODEL,
        ...RESEARCH_MODELS,
        FALLBACK_RESEARCH_MODEL,
        modelId,
        DEFAULT_MODEL,
      ],
      (id) => run(id),
      isModelAllowed,
    );
    console.log(`Research agent (${result.modelId}) concluído`);
    return result.value;
  } catch (error) {
    // Fallback do agente ja tentou a lista inteira. Deixa o erro subir para o
    // controller, que decide entre cota (salva parcial) e falha real.
    console.error('Research agent falhou:', error);
    throw error;
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

  const run = (id: string) =>
    getLlm(id).withStructuredOutput(researchResultSchema, {}).invoke(prompt);

  try {
    const result = await invokeWithFallback(
      [modelId, FALLBACK_FORMATTER_MODEL, DEFAULT_MODEL],
      run,
      isModelAllowed,
    );
    console.log(`Formatter (${result.modelId}) ok`);
    return result.value;
  } catch (error) {
    console.error('Formatter de pesquisa falhou:', error);
    throw error;
  }
}

import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { DeepLearningStateType } from '../state/deep-learning.state';
import { researchAgent } from '../subagents/research/research.agent';
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
  ]
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

    const agentResult = await researchAgent.invoke({
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
    });

    const researchText = extractResearchText(agentResult);

    const model = getLlm('openai/gpt-oss-120b');
    const formatter = model.withStructuredOutput(researchResultSchema, {});

    const formattedResults = await formatter.invoke(`
      ${FORMATTER_SYSTEM_PROMPT}

      Texto da pesquisa:
      """
      ${researchText}
      """
    `);

    config.writer?.({
      step: 'researchTopics',
      status: 'done',
      label: `Pesquisa concluída com sucesso.`,
    });

    return {
      researchResults: formattedResults.results,
    };
  };
}

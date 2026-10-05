import { LangGraphRunnableConfig } from '@langchain/langgraph';
import {
  DeepLearningStateType,
  EvaluationResult,
} from '../state/deep-learning.state';
import { getLlm } from '../llm.factory';
import { evaluationSchema } from '../schemas/evaluationSchema';

const SYSTEM_PROMPT = `Você é o avaliador pedagógico do Blueprint, responsável por verificar se o material de aprendizado gerado cobre a syllabus e é utilizável por um aluno.

## Tarefa
Avalie o material recebido e retorne:
1. "score": uma nota de 0 a 10 representam a qualidade e a completude do material.
2. "approved": true apenas quando o material estiver completo, coerente e pronto para o aluno (regra: score >= 7 e nenhum tópico obrigatório ficou de fora).
3. "missingTopics": os tópicos da syllabus que NÃO foram cobertos no material (use o id ou o título do subtópico, exatamente como aparecem na lista de subtópicos). Lista vazia se tudo foi coberto.
4. "feedback": um texto curto (2 a 5 frases) e objetivo, dizendo o que está bom e o que precisa ser corrigido. Se houver tópicos faltantes, diga explicitamente quais são e o que escrever sobre eles.

## Critérios de avaliação
- Cobertura: cada subtópico informado tem conteúdo correspondente, na ordem pedagógica da syllabus.
- Fidelidade: o conteúdo explica o que a syllabus pede, sem inventar fatos nem inventar fontes.
- Profundidade: cada tópico traz os 5 blocos esperados (o que é, como funciona, exemplo prático, erros comuns, resumo).
- Clareza: linguagem didática, em português do Brasil, frases curtas, sem enrolação e sem HTML.
- Escopo: nada de conteúdo fora do tema nem de código em blocos de texto que não seja Markdown.

## Regras
- Seja rigoroso, mas não invente problemas: se o material estiver bom, diga que está bom e aprove.
- Não reescreva o conteúdo, apenas avalie.
- Considere apenas o material e a syllabus fornecidos; não use conhecimento externo para exigir detalhes extras.
- "missingTopics" só aceita subtópicos da lista informada: nunca coloque nomes de vídeos, livros ou URLs.
- Retorne apenas os campos do schema, sem texto extra ao redor.

## Formato da resposta
JSON válido, sem texto antes ou depois, com os 4 campos sempre presentes:

{
  "approved": true | false,
  "score": 0,
  "missingTopics": [],
  "feedback": "2 a 5 frases"
}`;

function buildUserPrompt(state: DeepLearningStateType): string {
  const MAX_CONTENT_CHARS = 16000;
  let remainingChars = MAX_CONTENT_CHARS;

  const contentByTopic = state.topics
    .map((t) => {
      const content = t.content?.trim() || '(vazio)';
      const excerpt = content.slice(0, Math.max(0, remainingChars));

      remainingChars -= excerpt.length;

      return [
        `## id: ${t.id} — ${t.title}`,
        `Descrição: ${t.description}`,
        `Conteúdo gerado:`,
        excerpt || '(conteúdo omitido por limite de tamanho)',
      ].join('\n');
    })
    .join('\n\n');

  return `Tema geral:
    ${state.topic}

    Syllabus:
    """
    ${state.syllabus}
    """

    Resumo do material:
    ${state.summary || '(não gerado)'}

    Conteúdo por subtópico:
    ${contentByTopic || 'Nenhum conteúdo gerado.'}

    Rodada de revisão: ${state.revisionCount}`;
}

const EVALUATION_MODEL = 'google/gemma-4-26b-a4b-it:free';
const FALLBACK_EVALUATION_MODEL = 'google/gemma-4-31b-it:free';

async function evaluate(
  state: DeepLearningStateType,
): Promise<EvaluationResult> {
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: buildUserPrompt(state) },
  ];

  const run = async (modelId: string): Promise<EvaluationResult> => {
    const evaluator = getLlm(modelId, {
      temperature: 0.4,
    }).withStructuredOutput(evaluationSchema, {});
    return (await evaluator.invoke(messages)) as EvaluationResult;
  };

  try {
    return await run(EVALUATION_MODEL);
  } catch {
    return await run(FALLBACK_EVALUATION_MODEL);
  }
}

export const buildEvaluationNode = () => {
  return async (
    state: DeepLearningStateType,
    config: LangGraphRunnableConfig,
  ) => {
    config.writer?.({
      step: 'evaluation',
      status: 'start',
      label: 'Avaliando o desempenho...',
    });

    const result = await evaluate(state);

    console.log('Avaliação concluída com sucesso. Resultados:', result);

    config.writer?.({
      step: 'evaluation',
      status: 'done',
      label: `Avaliação concluída com sucesso.`,
    });

    const validTopics = new Set(
      state.topics.flatMap((t) => [t.id.toLowerCase(), t.title.toLowerCase()]),
    );
    const missingTopics = result.missingTopics
      .map((t) => t.trim())
      .filter((t) => validTopics.has(t.toLowerCase()));

    return {
      evaluation: {
        approved: result.approved,
        score: result.score,
        missingTopics,
        feedback: result.feedback,
      },
      revisionCount: state.revisionCount + 1,
    };
  };
};

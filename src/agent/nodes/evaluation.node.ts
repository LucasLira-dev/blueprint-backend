import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { DeepLearningStateType } from '../state/deep-learning.state';
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
- Retorne apenas os campos do schema, sem texto extra ao redor.`;

function buildUserPrompt(state: DeepLearningStateType): string {
  const contentByTopic = state.topics
    .map((t) =>
      [
        `## id: ${t.id} — ${t.title}`,
        `Descrição: ${t.description}`,
        `Conteúdo gerado:`,
        t.content?.trim() ? t.content.trim() : '(vazio)',
      ].join('\n'),
    )
    .join('\n\n');

  const research = state.researchResults.length
    ? state.researchResults
        .map((r) => {
          const sources = r.sources
            .map((s) => `    - ${s.title} (${s.url})`)
            .join('\n');
          return [
            `### ${r.topicId} — ${r.title}`,
            `Resumo: ${r.summary}`,
            `Pontos-chave:`,
            ...r.keyPoints.map((k) => `  - ${k}`),
            `Fontes:`,
            sources || '    - nenhuma',
          ].join('\n');
        })
        .join('\n\n')
    : 'Nenhuma pesquisa disponível. Avalie o material apenas com base na syllabus.';

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

    Pesquisa por subtópico (referência, use apenas para checar fidelidade):
    ${research}

    Rodada de revisão: ${state.revisionCount}`;
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

    const llm = getLlm('openai/gpt-oss-20b', { temperature: 0.4 });
    const evaluator = llm.withStructuredOutput(evaluationSchema, {});

    const result = await evaluator.invoke([
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: buildUserPrompt(state),
      },
    ]);

    config.writer?.({
      step: 'evaluation',
      status: 'done',
      label: `Avaliação concluída com sucesso.`,
    });

    return {
      evaluation: {
        approved: result.approved,
        score: result.score,
        missingTopics: result.missingTopics,
        feedback: result.feedback,
      },
      revisionCount: state.revisionCount + 1,
    };
  };
};

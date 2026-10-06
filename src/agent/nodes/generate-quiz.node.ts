import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { DeepLearningStateType } from '../state/deep-learning.state';
import {
  DEFAULT_MODEL,
  QUIZ_MODELS,
  getLlm,
  isModelAllowed,
} from '../llm.factory';
import { invokeWithFallback, isQuotaError } from '../llm-retry';
import { quizSchema } from '../schemas/quizSchema';

const SYSTEM_PROMPT = `Você é o avaliador do Blueprint, especialista em criar questões de múltipla escolha que verificam se o aluno realmente entendeu o conteúdo.

## Tarefa
Gere DEZ questões e retorne obrigatoriamente um objeto JSON no seguinte formato:

{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": "...",
      "explanation": "..."
    }
  ]
}

Cada questão deve seguir estas regras:
1. "question": enunciado objetivo e sem pistas que revelem a resposta.
2. "options": exatamente 4 alternativas, com uma única correta. Devem ter tamanhos parecidos, variar entre correta e incorretas e nunca incluir "todas as alternativas" ou "nenhuma das alternativas".
3. "correctAnswer": texto EXATO, copiado sem alterações, de uma das alternativas em "options".
4. "explanation": de 1 a 3 frases explicando por que a alternativa correta é correta e por que as outras são enganosas.

## Regras
- Retorne exatamente 10 questões dentro de "questions".
- Baseie as questões exclusivamente no material fornecido.
- Não exija conhecimento externo ou detalhes que não foram ensinados.
- Não use expressões como "conforme vimos acima" ou qualquer referência ao material.
- Evite ambiguidade: apenas uma alternativa pode ser defendida como correta.
- Escreva em português do Brasil, com linguagem didática e frases curtas.
- Formate o enunciado em Markdown, usando código inline ao mencionar termos técnicos, por exemplo: \`useState\`.
- Não revele a resposta no enunciado.
- Não use letras ou números nas alternativas; a formatação fica por conta da aplicação.
- Não adicione propriedades além de "questions", "question", "options", "correctAnswer" e "explanation".`;

function buildUserPrompt(state: DeepLearningStateType): string {
  const topicsList = state.topics
    .map(
      (t) => `- id: ${t.id} | título: ${t.title} | descrição: ${t.description}`,
    )
    .join('\n');

  const content = state.topics
    .map((t) =>
      [
        `### ${t.id} — ${t.title}`,
        t.content?.trim() ? t.content.trim() : '(vazio)',
      ].join('\n'),
    )
    .join('\n\n');

  return `Tema geral:
    ${state.topic}

    Syllabus:
    """
    ${state.syllabus}
    """

    Resumo do aprendizado:
    ${state.summary || '(não gerado)'}

    Subtópicos:
    ${topicsList}

    Conteúdo do aprendizado (base para a questão):
    ${content || 'Nenhum conteúdo gerado. Crie a questão apenas com base na syllabus.'}`;
}

export const buildGenerateQuizNode = () => {
  return async (
    state: DeepLearningStateType,
    config: LangGraphRunnableConfig,
  ) => {
    config.writer?.({
      step: 'generateQuiz',
      status: 'start',
      label: 'Gerando quiz do aprendizado...',
    });

    const generate = (modelId: string) =>
      getLlm(modelId, { temperature: 0.4 })
        .withStructuredOutput(quizSchema, {})
        .invoke([
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildUserPrompt(state),
          },
        ]);

    try {
      const run = await invokeWithFallback(
        [...QUIZ_MODELS, state.model, DEFAULT_MODEL],
        generate,
        isModelAllowed,
      );

      const questions = run.value.questions ?? [];
      console.log(`Quiz gerado (${run.modelId}): ${questions.length} questões`);

      config.writer?.({
        step: 'generateQuiz',
        status: 'done',
        label: `Quiz gerado com sucesso.`,
      });

      return {
        quiz: run.value.questions ?? [],
      };
    } catch (error) {
      // O conteudo ja esta validado. Se so a cota do quiz estourou, entregar a
      // trilha sem quiz vale mais do que descartar tudo na ultima etapa.
      if (isQuotaError(error)) {
        console.warn(
          'Cota esgotada antes do quiz; entregando sem quiz:',
          error,
        );

        config.writer?.({
          step: 'generateQuiz',
          status: 'done',
          label: 'Quiz pulado por limite de uso; o conteúdo está completo.',
        });

        return { quiz: [] };
      }

      throw error;
    }
  };
};

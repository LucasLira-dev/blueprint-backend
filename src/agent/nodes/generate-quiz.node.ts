import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { DeepLearningStateType } from '../state/deep-learning.state';
import { getLlm } from '../llm.factory';
import { quizSchema } from '../schemas/quizSchema';

const SYSTEM_PROMPT = `Você é o avaliador do Blueprint, especialista em criar questões de múltipla escolha que verificam se o aluno realmente entendeu o conteúdo.

## Tarefa
Gere UMA questão no formato do schema:
1. "question": o enunciado, objetivo e sem pistas que revelem a resposta.
2. "options": 4 alternativas, com uma única correta. Devem ter tamanhos parecidos, variar entre correta e incorretas e nunca incluir "todas as alternativas" ou "nenhuma das alternativas".
3. "correctAnswer": o texto EXATO, copiado sem alterações, de uma das alternativas em "options".
4. "explanation": 1 a 3 frases explicando por que a alternativa correta é a correta e por que as outras são enganosas.

## Regras
- Baseie a questão exclusivamente no material fornecido: nada de exigir conhecimento externo ou detalhes que não foram ensinados.
- Não use expressões como "conforme vimos acima" ou qualquer referência ao material: o enunciado deve ser autossuficiente.
- Evite ambiguidade: apenas uma alternativa pode ser defendida como correta.
- Escreva em português do Brasil, linguagem didática e frases curtas.
- Formate o enunciado em Markdown, com o código inline quando mencionar um termo técnico, ex.: \`useState\`.
- Não revele qual é a alternativa correta no enunciado e não use letras ou números nas alternativas (a formatação fica por conta da aplicação).`;

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

    const model = getLlm(state.model, { temperature: 0.4 });
    const generator = model.withStructuredOutput(quizSchema, {});

    const result = await generator.invoke([
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
      step: 'generateQuiz',
      status: 'done',
      label: `Quiz gerado com sucesso.`,
    });

    return {
      quiz: [
        {
          question: result.question,
          options: result.options,
          correctAnswer: result.correctAnswer,
          explanation: result.explanation,
        },
      ],
    };
  };
};

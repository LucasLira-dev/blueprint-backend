import { ChatGroq } from '@langchain/groq';
import { DeepLearningStateType } from '../state/deep-learning.state';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { ExtractTopicsSchema } from '../schemas/deepLearningSchema';

const llm = new ChatGroq({
  model: 'openai/gpt-oss-20b',
  apiKey: process.env.GROQ_API_KEY ?? '',
  temperature: 0.7,
});

export function buildExtractTopicsNode() {
  return async (
    state: DeepLearningStateType,
    config: LangGraphRunnableConfig,
  ) => {
    config.writer?.({
      step: 'extractTopics',
      status: 'start',
      label: 'Extraindo os tópicos do aprendizado...',
    });

    const extractor = llm.withStructuredOutput(ExtractTopicsSchema, {});

    const result = await extractor.invoke(`
    Você é um pedagogo especialista em criar trilhas de aprendizado profundo.

    TAREFA: A partir da syllabus (ementa/plano de estudos) fornecida, decomponha o tema em
    subtemas específicos, coerentes e interdependentes que formem uma jornada de aprendizado
    profunda, progressiva e acionável.

    REGRAS:
    - Extraia EXATAMENTE de 4 a 8 subtemas.
    - Cada subtema deve ser um bloco coeso que ensina um conceito, habilidade ou domínio prático.
    Exemplos: "State do React: useState e useReducer", "Hooks e ciclo de vida", "Context API e estado global".
    - Ordene pedagogicamente: do fundamental ao avançado, respeitando as dependências entre conteúdos.
    - Use nomes canônicos e curtos (máx. ~6 palavras) e expanda siglas/abreviações (React, Node.js, APIs...).
    - A description deve explicar em 1 a 2 frases o que o usuário vai aprender naquele subtema e por que isso importa na jornada.
    - Cubra a syllabus por completo, sem tópicos redundantes, superficiais ou fora do escopo do tema.
    - O id deve ser simples, único e em formato slug (ex.: "react-state").

    Syllabus do plano:
    """
    ${state.syllabus}
    """
    `);

    const topics = result.topics;

    config.writer?.({
      step: 'extractTopics',
      status: 'done',
      label: `${topics.length} tópicos extraídos com sucesso.`,
    });

    return { topics };
  };
}

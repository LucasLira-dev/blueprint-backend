import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { StudyPlanStateType } from '../state/study-plan.state';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

const llm = new ChatGoogleGenerativeAI({
  model: process.env.GOOGLE_GENAI_MODEL ?? 'gemini-2.5-flash',
  apiKey: process.env.GOOGLE_API_KEY ?? '',
  temperature: 0,
});

export function buildExtractSearchQueryNode() {
  return async (state: StudyPlanStateType, config: LangGraphRunnableConfig) => {
    config.writer?.({
      step: 'extractSearchQuery',
      status: 'start',
      label: 'Extraindo a query de pesquisa...',
    });

    const prompt = `Extraia APENAS o termo de busca principal (2 a 5 palavras, sem frases) do pedido
        abaixo, ideal para pesquisar vídeos e livros sobre o assunto. Responda só com o termo,
        sem aspas, sem explicação.

        Pedido: "${state.topic}"`;

    const response = await llm.invoke(prompt);

    const searchQuery =
      typeof response.content === 'string'
        ? response.content
        : response.content
            .map((c) => (typeof c === 'string' ? c : c.text))
            .join('');

    config.writer?.({
      step: 'extractSearchQuery',
      status: 'done',
      label: 'Query de pesquisa extraída com sucesso.',
    });

    return { searchQuery };
  };
}

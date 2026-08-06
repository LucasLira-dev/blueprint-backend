import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { StudyPlanStateType } from '../state/study-plan.state';
import { ChatGroq } from '@langchain/groq';
import { SearchQuerySchema } from '../searchQuerySchema';

const llm = new ChatGroq({
  model: 'openai/gpt-oss-20b',
  apiKey: process.env.GROQ_API_KEY ?? '',
  temperature: 0,
});

export function buildExtractSearchQueryNode() {
  return async (state: StudyPlanStateType, config: LangGraphRunnableConfig) => {
    config.writer?.({
      step: 'extractSearchQuery',
      status: 'start',
      label: 'Extraindo a query de pesquisa...',
    });

    const extractor = llm.withStructuredOutput(SearchQuerySchema, {});

    const result = await extractor.invoke(`
Extraia as informações relevantes do pedido.

Pedido:
"${state.topic}"
`);

    config.writer?.({
      step: 'extractSearchQuery',
      status: 'done',
      label: 'Query de pesquisa extraída com sucesso.',
    });

    return { search: result };
  };
}

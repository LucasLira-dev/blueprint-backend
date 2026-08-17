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

ANTES de extrair, normalize o tema:
- Expanda abreviações e siglas: "js" → "JavaScript", "ts" → "Typescript", "py" → "Python", "rs" → "Rust", "go" → "Go", "rb" → "Ruby", "cs" → "C#", "cpp" → "C++", "ai" → "Inteligência Artificial", "ml" → "Machine Learning", "dd" → "Design de Desenvolvimento", etc.
- Corrija ortografia quando necessário
- Use o nome completo e padronizado da tecnologia/área

Exemplos:
- "js" → subject: "JavaScript"
- "quero aprender react native" → subject: "React Native"
- "ia" → subject: "Inteligência Artificial"
- "py" → subject: "Python"
- "ml" → subject: "Machine Learning"

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

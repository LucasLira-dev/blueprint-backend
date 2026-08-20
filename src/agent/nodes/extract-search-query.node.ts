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
- Expanda abreviações e siglas: "js" → "JavaScript", "ts" → "Typescript", "py" → "Python", "rs" → "Rust", "go" → "Go", "rb" → "Ruby", "cs" → "C#", "cpp" → "C++", "ai" → "Inteligência Artificial", "ml" → "Machine Learning", etc.
- Corrija ortografia quando necessário
- Use o nome completo e padronizado da tecnologia/área

REGRAS PARA O CAMPO subject (usado em buscas no YouTube):
- O subject deve ser um termo de busca eficaz para encontrar vídeo-aulas e tutoriais.
- Se o tema NÃO for relacionado a tecnologia/programação (ex: culinária, música, esporte, finanças, saúde), NÃO adicione contexto de tecnologia. Use o termo normalizado sem modificações.
- Para tecnologias com nomes genéricos ou ambíguos, SEMPRE adicione contexto que identifique como assunto de programação/tecnologia.
  Exemplos:
  - "react" → subject: "ReactJS framework programação"
  - "go" → subject: "Go linguagem programação"
  - "rust" → subject: "Rust programação"
  - "ruby" → subject: "Ruby programação"
  - "dart" → subject: "Dart linguagem programação"
  - "scala" → subject: "Scala programação"
  - "elixir" → subject: "Elixir programação"
  - "swift" → subject: "Swift programação iOS"
  - "flutter" → subject: "Flutter framework mobile"
  - "next" → subject: "Next.js framework React"
  - "nuxt" → subject: "Nuxt.js framework Vue"
- Para tecnologias sem ambiguidade, use o nome padronizado + contexto de busca útil:
  Exemplos:
  - "javascript" → subject: "JavaScript programação"
  - "python" → subject: "Python programação"
  - "typescript" → subject: "TypeScript programação"
  - "java" → subject: "Java programação"
  - "c#" → subject: "C# programação"
  - "php" → subject: "PHP programação"
  - "html" → subject: "HTML tutorial"
  - "css" → subject: "CSS tutorial"
  - "sql" → subject: "SQL banco de dados"
  - "docker" → subject: "Docker devops"
  - "kubernetes" → subject: "Kubernetes devops"
  - "react native" → subject: "React Native mobile programação"
  - "machine learning" → subject: "Machine Learning inteligência artificial"
  - "inteligência artificial" → subject: "Inteligência Artificial programação"

Exemplos de normalização completa:
- "js" → subject: "JavaScript programação"
- "quero aprender react native" → subject: "React Native mobile programação"
- "ia" → subject: "Inteligência Artificial programação"
- "py" → subject: "Python programação"
- "ml" → subject: "Machine Learning inteligência artificial"
- "como usar docker" → subject: "Docker devops"
- "culinária italiana" → subject: "Culinária italiana" (SEM contexto de tecnologia)
- "como tocar violão" → subject: "Tocar violão" (SEM contexto de tecnologia)
- "receita de bolo" → subject: "Receita de bolo" (SEM contexto de tecnologia)

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

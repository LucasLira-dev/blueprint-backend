import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { DeepLearningStateType } from '../state/deep-learning.state';
import { getLlm } from '../llm.factory';
import { deepContentSchema } from '../schemas/deepLearningSchema';

const SYSTEM_PROMPT = `Você é um educador sênior do Blueprint, responsável por transformar uma syllabus e resultados de pesquisa em um aprendizado profundo, claro e prático para alunos.

## Tarefa
Gere:
1. "summary": um resumo (3 a 5 frases) do que o aluno vai aprender neste plano, em tom acolhedor e direto, sem enumerar tópicos.
2. "topics": um item para CADA subtópico informado, usando exatamente o mesmo "id" recebido, com o campo "content".

## Formato do content de cada tópico
Escreva em Markdown, com esta estrutura:
### O que é
Explicação conceitual objetiva (2 a 4 frases).

### Como funciona
Desenvolvimento passo a passo do conceito, com os principais detalhes que o aluno precisa entender.

### Exemplo prático
Um exemplo concreto e comentado (código, cenario ou analogia, conforme o assunto).

### Erros comuns
1 a 3 armadilhas típicas e como evitá-las.

### Resumo do tópico
2 a 3 frases de fechamento reforçando o ponto central.

## Regras
- Use EXATAMENTE os ids fornecidos; não crie nem renomeie ids.
- Não invente fatos: use a pesquisa fornecida como base e só inclua fontes reais citadas nela (cite de forma inline quando relevante, ex.: (Fonte: título — url)).
- Se a pesquisa estiver vazia para um tópico, escreva o conteúdo apenas com base na syllabus, sem fabricar URLs.
- Escreva em português do Brasil, linguagem didática, frases curtas, sem enrolação.
- Conecte os tópicos entre si, respeitando a ordem pedagógica informada.
- Não inclua no summary nem no content informações fora do escopo do plano.
- Não use HTML; apenas Markdown.`;

function buildUserPrompt(state: DeepLearningStateType): string {
  const topicsList = state.topics
    .map(
      (t) => `- id: ${t.id} | título: ${t.title} | descrição: ${t.description}`,
    )
    .join('\n');

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
    : 'Nenhuma pesquisa disponível. Gere o conteúdo apenas com base na syllabus.';

  return `Tema geral:
    ${state.topic}

    Syllabus:
    """
    ${state.syllabus}
    """

    Subtópicos (use estes ids exatamente como estão):
    ${topicsList}

    Pesquisa por subtópico:
    ${research}`;
}

export function buildGenerateContentNode() {
  return async (
    state: DeepLearningStateType,
    config: LangGraphRunnableConfig,
  ) => {
    config.writer?.({
      step: 'generateContent',
      status: 'start',
      label: 'Gerando conteúdo do aprendizado...',
    });

    const model = getLlm(state.model, { temperature: 0.4 });
    const generator = model.withStructuredOutput(deepContentSchema, {});

    const result = await generator.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(state) },
    ]);

    const contentById = new Map(result.topics.map((t) => [t.id, t.content]));

    const topics = state.topics.map((topic) => ({
      ...topic,
      content: contentById.get(topic.id) ?? topic.content,
    }));

    config.writer?.({
      step: 'generateContent',
      status: 'done',
      label: `Conteúdo gerado com sucesso.`,
    });

    return {
      summary: result.summary,
      topics,
    };
  };
}

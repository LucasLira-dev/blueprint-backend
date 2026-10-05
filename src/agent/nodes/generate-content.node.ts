import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { z } from 'zod';
import { DeepLearningStateType } from '../state/deep-learning.state';
import { getLlm } from '../llm.factory';

const MODEL_ID = 'qwen/qwen3.8-27b';
const CONTENT_BATCH_SIZE = 3;
const MAX_TOKENS = 4_096;

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

const contentBatchSchema = z.object({
  topics: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
    }),
  ),
});

const summarySchema = z.object({ summary: z.string() });

type Topic = DeepLearningStateType['topics'][number];

function buildTopicsList(topics: Topic[]): string {
  return topics
    .map(
      (t) => `- id: ${t.id} | título: ${t.title} | descrição: ${t.description}`,
    )
    .join('\n');
}

function buildResearch(state: DeepLearningStateType, topics: Topic[]): string {
  const allowed = new Set(topics.map((t) => t.id));
  const results = state.researchResults.filter((r) => allowed.has(r.topicId));

  if (!results.length) {
    return 'Nenhuma pesquisa disponível. Gere o conteúdo apenas com base na syllabus.';
  }

  return results
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
    .join('\n\n');
}

function buildBatchPrompt(
  state: DeepLearningStateType,
  topics: Topic[],
): string {
  return `Tema geral:
    ${state.topic}

    Syllabus:
    """
    ${state.syllabus}
    """

    Subtópicos (use estes ids exatamente como estão):
    ${buildTopicsList(topics)}

    Pesquisa por subtópico:
    ${buildResearch(state, topics)}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
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

    const model = getLlm(MODEL_ID, { temperature: 0.4, maxTokens: MAX_TOKENS });
    const batches = chunk(state.topics, CONTENT_BATCH_SIZE);

    const start = Date.now();

    const summary = (
      await model.withStructuredOutput(summarySchema, {}).invoke([
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Tema geral: ${state.topic}\n\nSyllabus:\n"""\n${state.syllabus}\n"""\n\nSubtópicos do plano:\n${buildTopicsList(state.topics)}\n\nGere apenas o campo "summary".`,
        },
      ])
    ).summary;

    console.log(`Summary: ${(Date.now() - start) / 1000}s`);

    const contentById = new Map<string, string>();

    for (const [index, batch] of batches.entries()) {
      const result = await model
        .withStructuredOutput(contentBatchSchema, {})
        .invoke([
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildBatchPrompt(state, batch) },
        ]);

      console.log(`Batch ${index + 1}: ${(Date.now() - start) / 1000}s`);

      for (const topic of result.topics) {
        contentById.set(topic.id, topic.content);
      }

      config.writer?.({
        step: 'generateContent',
        status: 'streaming',
        label: `Conteúdo gerado para ${index + 1}/${batches.length} parte(s).`,
      });
    }

    const topics = state.topics.map((topic) => ({
      ...topic,
      content: contentById.get(topic.id) ?? topic.content,
    }));

    console.log('Conteúdo gerado com sucesso. Resultados:', {
      summary,
      topics,
    });

    config.writer?.({
      step: 'generateContent',
      status: 'done',
      label: `Conteúdo gerado com sucesso.`,
    });

    return {
      summary,
      topics,
    };
  };
}

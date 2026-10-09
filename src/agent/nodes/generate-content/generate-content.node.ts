import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { DeepLearningStateType } from '../../state/deep-learning.state';
import {
  CONTENT_MODELS,
  DEFAULT_MODEL,
  SUMMARY_MODELS,
  isModelAllowed,
} from '../../llm.factory';
import { invokeWithFallback } from '../../llm-retry';
import { generateSummary as createSummary } from './generateSummary';
import { generateBatch as createBatch } from './generateTopicsBatch';
import {
  chunk,
  CONTENT_BATCH_SIZE,
  ContentValidationError,
  isValidTopicContent,
  REPAIR_ATTEMPTS,
} from './utils';
import { Logger } from '@nestjs/common';

const logger = new Logger('GenerateContentNode');

export const SYSTEM_PROMPT = `Você é um educador sênior do Blueprint, responsável por transformar uma syllabus e resultados de pesquisa em um aprendizado profundo, claro e prático para alunos.

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

export type Topic = DeepLearningStateType['topics'][number];

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

    const start = Date.now();

    const generateSummary = (modelId: string) => createSummary(modelId, state);

    const generateBatch = (modelId: string, topics: Topic[]) =>
      createBatch(modelId, topics, state);

    // Na revisao ja existe um resumo valido: regenerar so para queimar cota.
    let summary = state.summary?.trim() ?? '';
    if (!summary) {
      const summaryRun = await invokeWithFallback(
        [...SUMMARY_MODELS, state.model, DEFAULT_MODEL],
        generateSummary,
        isModelAllowed,
      );
      summary = summaryRun.value.summary;
      logger.log(
        `Summary (${summaryRun.modelId}): ${(Date.now() - start) / 1000}s`,
      );
    } else {
      logger.log('Summary reutilizado da rodada anterior');
    }

    // Revisao: mantem o que ja passou na validacao e so gera o que faltou.
    const contentById = new Map<string, string>();
    for (const topic of state.topics) {
      if (isValidTopicContent(topic.content)) {
        contentById.set(topic.id, topic.content!);
      }
    }

    const pending = state.topics.filter((topic) => !contentById.has(topic.id));

    const invalidAfterBatch = new Set<string>();

    if (pending.length) {
      logger.log(
        `${pending.length}/${state.topics.length} topicos precisam de conteudo`,
      );

      const batches = chunk(pending, CONTENT_BATCH_SIZE);

      for (const [index, batch] of batches.entries()) {
        const run = await invokeWithFallback(
          [...CONTENT_MODELS, state.model, DEFAULT_MODEL],
          (modelId) => generateBatch(modelId, batch),
          isModelAllowed,
        );

        for (const topic of run.value.topics) {
          const requested = batch.some((b) => b.id === topic.id);
          if (requested && isValidTopicContent(topic.content)) {
            contentById.set(topic.id, topic.content);
          }
        }

        for (const topic of batch) {
          if (!contentById.has(topic.id)) invalidAfterBatch.add(topic.id);
        }

        logger.log(
          `Batch ${index + 1}/${batches.length} (${run.modelId}): ${(Date.now() - start) / 1000}s`,
        );

        config.writer?.({
          step: 'generateContent',
          status: 'streaming',
          label: `Conteúdo gerado para ${index + 1}/${batches.length} parte(s).`,
        });
      }
    }

    // Reparo: um topico por vez, com o próximo modelo da cadeia, para nao
    // re-renderizar os lotes que ja vieram corretos.
    if (invalidAfterBatch.size) {
      logger.warn(`Reparando topicos: ${[...invalidAfterBatch].join(', ')}`);
    }

    for (let attempt = 1; attempt <= REPAIR_ATTEMPTS; attempt++) {
      if (!invalidAfterBatch.size) break;

      const retryTopics = pending.filter((t) => invalidAfterBatch.has(t.id));

      for (const topic of retryTopics) {
        const run = await invokeWithFallback(
          [...CONTENT_MODELS, state.model, DEFAULT_MODEL],
          (modelId) => generateBatch(modelId, [topic]),
          isModelAllowed,
        );

        const produced = run.value.topics.find((t) => t.id === topic.id);
        if (produced && isValidTopicContent(produced.content)) {
          contentById.set(topic.id, produced.content);
          invalidAfterBatch.delete(topic.id);
          logger.log(
            `Reparo do topico ${topic.id} ok (${run.modelId}, tentativa ${attempt})`,
          );
        } else {
          logger.warn(
            `Reparo do topico ${topic.id} falhou (${run.modelId}, tentativa ${attempt})`,
          );
        }
      }
    }

    if (invalidAfterBatch.size) {
      throw new ContentValidationError([...invalidAfterBatch]);
    }

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
      summary,
      topics,
    };
  };
}

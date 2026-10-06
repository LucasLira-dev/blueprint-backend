import { getLlm } from 'src/agent/llm.factory';
import { DeepLearningStateType } from 'src/agent/state/deep-learning.state';
import { SYSTEM_PROMPT } from './generate-content.node';
import z from 'zod';
import { buildTopicsList } from './utils';

const SUMMARY_MAX_TOKENS = 512;

const summarySchema = z.object({ summary: z.string() });

export const generateSummary = (
  modelId: string,
  state: DeepLearningStateType,
) =>
  getLlm(modelId, {
    temperature: 0.4,
    maxTokens: SUMMARY_MAX_TOKENS,
  })
    .withStructuredOutput(summarySchema, {})
    .invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Tema geral: ${state.topic}\n\nSyllabus:\n"""\n${state.syllabus}\n"""\n\nSubtópicos do plano:\n${buildTopicsList(state.topics)}\n\nGere apenas o campo "summary".`,
      },
    ]) as Promise<{ summary: string }>;

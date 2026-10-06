import { DeepLearningStateType } from 'src/agent/state/deep-learning.state';
import { SYSTEM_PROMPT, Topic } from './generate-content.node';
import { getLlm } from 'src/agent/llm.factory';
import z from 'zod';
import { buildResearch } from './buildResearch';
import { buildTopicsList } from './utils';

const CONTENT_MAX_TOKENS = 2_000;

const contentBatchSchema = z.object({
  topics: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
    }),
  ),
});

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

export const generateBatch = (
  modelId: string,
  topics: Topic[],
  state: DeepLearningStateType,
) =>
  getLlm(modelId, {
    temperature: 0.4,
    maxTokens: CONTENT_MAX_TOKENS,
  })
    .withStructuredOutput(contentBatchSchema, {})
    .invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildBatchPrompt(state, topics) },
    ]) as Promise<z.infer<typeof contentBatchSchema>>;

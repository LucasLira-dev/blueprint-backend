import { z } from 'zod';

export const researchResultSchema = z.object({
  results: z.array(
    z.object({
      topicId: z.string(),
      title: z.string(),
      summary: z.string(),
      keyPoints: z.array(z.string()),
      sources: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
        }),
      ),
    }),
  ),
  researchStatus: z.enum(['success', 'degraded', 'failed']),
});

export type ResearchOutput = z.infer<typeof researchResultSchema>;

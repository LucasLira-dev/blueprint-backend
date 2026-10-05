import z from 'zod';

export const evaluationSchema = z.object({
  approved: z.boolean().default(false),
  score: z.number().min(0).max(10).default(0),
  missingTopics: z.array(z.string()).default([]),
  feedback: z.string().default(''),
});

export type EvaluationOutput = z.infer<typeof evaluationSchema>;

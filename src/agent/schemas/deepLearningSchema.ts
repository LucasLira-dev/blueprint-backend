import z from 'zod';

export const TopicSchema = z.object({
  id: z.string().describe('Identificador único do tópico.'),
  title: z.string().describe('Título do tópico.'),
  description: z.string().describe('Descrição do tópico.'),
});

export const ExtractTopicsSchema = z.object({
  topics: z
    .array(TopicSchema)
    .describe('Lista de 4 a 8 subtemas extraídos da syllabus.'),
});

export const deepContentSchema = z.object({
  summary: z.string(),
  topics: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
    }),
  ),
});

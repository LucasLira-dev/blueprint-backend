import { z } from 'zod';

export const SearchQuerySchema = z.object({
  subject: z.string().describe('Assunto principal da pesquisa.'),

  intent: z
    .enum(['learn', 'review', 'practice', 'understand', 'other'])
    .describe('Intenção principal do usuário.'),

  level: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .optional()
    .describe('Nível mencionado pelo usuário.'),

  searchQuery: z
    .string()
    .optional()
    .describe(
      'Consulta otimizada para mecanismos de busca de livros e vídeos.',
    ),
});

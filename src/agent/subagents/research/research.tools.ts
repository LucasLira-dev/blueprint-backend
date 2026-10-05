import {
  GoogleGenerativeAI,
  type GoogleSearchRetrievalTool,
} from '@google/generative-ai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export const internetSearch = new DynamicStructuredTool({
  name: 'internet_search',
  description:
    'Realiza uma busca na web usando Grounding com Google Search (Gemini). ' +
    'Recebe uma query em texto e retorna um resumo do conteúdo encontrado acompanhado das fontes (URLs reais). ' +
    'Use para pesquisar documentação, tutoriais, artigos, notícias e qualquer informação atual que o modelo não conheça.',
  schema: z.object({
    query: z
      .string()
      .describe(
        'Termos de busca claros e específicos, em português ou inglês. Ex.: "how react lifecycle works", "melhores cursos de estatística para iniciantes 2026".',
      ),
  }),
  func: async ({ query }) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return 'API key do Google (GOOGLE_API_KEY) não configurada.';
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      // A API depreciou `googleSearchRetrieval` em favor de `google_search`.
      // O SDK 0.24.1 ainda tipa apenas o nome antigo, mas repassa o objeto
      // sem alteracao, entao usamos o nome novo com um cast.
      tools: [{ google_search: {} } as unknown as GoogleSearchRetrievalTool],
    });

    let res: Awaited<ReturnType<typeof model.generateContent>>;
    try {
      res = await withRetry(() =>
        model.generateContent(query, { timeout: 60_000 }),
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'erro desconhecido';
      return `A busca falhou (${reason}). Tente novamente com uma query mais específica ou siga sem esta fonte.`;
    }

    const response = res.response;
    const text = (response.text?.() ?? '').trim();
    const chunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

    if (!text) {
      return 'A busca não retornou conteúdo relevante. Tente reformular a query.';
    }

    const sources = chunks
      .map((chunk, index) => {
        const web = chunk.web;
        return web?.uri
          ? `[${index + 1}] ${web.title ?? 'Fonte'} — ${web.uri}`
          : null;
      })
      .filter((source): source is string => source !== null)
      .join('\n');

    return sources ? `${text}\n\nFontes:\n${sources}` : text;
  },
});

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import { ChatOpenAI } from '@langchain/openai';
import { BadRequestException } from '@nestjs/common';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const llmCache = new Map<string, BaseChatModel>();

export type ModelProvider = 'google' | 'groq' | 'openrouter';

export interface ModelDefinition {
  id: string;
  provider: ModelProvider;
  label: string;
}

// O flash puro do Gemini free tier limita ~20 req/dia; o flash-lite tem
// ordens de grandeza mais folgadas e o custo de qualidade nao compensa o risco
// de estourar a cota no primeiro plano.
export const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

export const FREE_MODELS: ModelDefinition[] = [
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    label: 'Gemini 2.5 Flash',
  },
  {
    id: 'gemini-2.5-flash-lite',
    provider: 'google',
    label: 'Gemini 2.5 Flash Lite',
  },
  {
    id: 'gemini-3.1-flash-lite',
    provider: 'google',
    label: 'Gemini 3.1 Flash Lite',
  },
  {
    id: 'gemini-3.5-flash',
    provider: 'google',
    label: 'Gemini 3.5 Flash',
  },
  {
    id: 'openai/gpt-oss-120b',
    provider: 'groq',
    label: 'GPT-OSS 120B (Groq)',
  },
  {
    id: 'openai/gpt-oss-20b',
    provider: 'groq',
    label: 'GPT-OSS 20B (Groq)',
  },
  {
    id: 'qwen/qwen3.6-27b',
    provider: 'groq',
    label: 'Qwen3.6 27B (Groq)',
  },
  {
    id: 'qwen/qwen3.8-27b',
    provider: 'groq',
    label: 'Qwen3.8 27B (Groq)',
  },
  {
    id: 'minimax/minimax-m3',
    provider: 'openrouter',
    label: 'MiniMax M3 (OpenRouter)',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    provider: 'openrouter',
    label: 'Google Gemma 4 26B A4B (OpenRouter)',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    provider: 'openrouter',
    label: 'Google Gemma 4 31B (OpenRouter)',
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    provider: 'openrouter',
    label: 'Nemotron 3 Ultra 550B (OpenRouter)',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    provider: 'openrouter',
    label: 'Nemotron 3 Super 120B (OpenRouter)',
  },
  {
    id: 'thinkingmachines/inkling:free',
    provider: 'openrouter',
    label: 'Inkling (OpenRouter)',
  },
  {
    id: 'poolside/laguna-s-2.1:free',
    provider: 'openrouter',
    label: 'Laguna S 2.1 (OpenRouter)',
  },
];

export function isModelAllowed(id: string): boolean {
  return FREE_MODELS.some((m) => m.id === id);
}

export function getModelDefinition(id: string): ModelDefinition {
  const def = FREE_MODELS.find((m) => m.id === id);
  if (!def) {
    throw new BadRequestException(`Modelo não suportado: ${id}`);
  }
  return def;
}

export const DEFAULT_MAX_TOKENS = 8_192;

// As cotas diarias (Groq TPD, Gemini RPD, OpenRouter free RPD) sao por modelo.
// Espalhar a carga por varios modelos multiplica o budget de requisicoes
// disponiveis sem custo nenhum. A ordem importa: primeiro o que tem mais folga.
export const CONTENT_MODELS: string[] = [
  'openai/gpt-oss-120b',
  'minimax/minimax-m3',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'qwen/qwen3.6-27b',
];

export const SUMMARY_MODELS: string[] = [
  'minimax/minimax-m3',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b',
];

export const RESEARCH_MODELS: string[] = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3.8-27b',
];

export const EVALUATION_MODELS: string[] = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
];

export const QUIZ_MODELS: string[] = [
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'qwen/qwen3.6-27b',
];

export function getLlm(
  modelId: string,
  options: { temperature?: number; maxTokens?: number } = {},
): BaseChatModel {
  const temperature = options.temperature ?? 0.4;
  // Sem maxTokens explicito o provedor assume a janela completa do modelo
  // (ex.: 131072 no OpenRouter) e a requisicao e rejeitada com 402 por saldo.
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const cacheKey = `${modelId}:${temperature}:${maxTokens}`;

  const cached = llmCache.get(cacheKey);
  if (cached) return cached;

  const { provider } = getModelDefinition(modelId);

  let llm: BaseChatModel;

  switch (provider) {
    case 'google':
      llm = new ChatGoogleGenerativeAI({
        model: modelId,
        apiKey: process.env.GOOGLE_API_KEY,
        temperature,
        maxOutputTokens: maxTokens,
        maxRetries: 0,
      });
      break;

    case 'groq':
      llm = new ChatGroq({
        model: modelId,
        apiKey: process.env.GROQ_API_KEY,
        temperature,
        maxTokens,
        maxRetries: 0,
        timeout: 120_000,
      });
      break;

    case 'openrouter':
      llm = new ChatOpenAI({
        model: modelId,
        apiKey: process.env.OPENROUTER_API_KEY,
        temperature,
        maxTokens,
        maxRetries: 0,
        timeout: 120_000,
        configuration: {
          baseURL: OPENROUTER_BASE_URL,
          defaultHeaders: {
            'HTTP-Referer': process.env.OPENROUTER_APP_URL ?? '',
            'X-Title': process.env.OPENROUTER_APP_TITLE ?? 'Blueprint',
          },
        },
      });
      break;

    default:
      throw new BadRequestException(`Provedor de modelo não suportado.`);
  }

  llmCache.set(cacheKey, llm);
  return llm;
}

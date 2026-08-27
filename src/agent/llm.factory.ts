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

export const DEFAULT_MODEL = 'gemini-2.5-flash';

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
    id: 'minimax/minimax-m3:free',
    provider: 'openrouter',
    label: 'MiniMax M3 (OpenRouter)',
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

export function getLlm(
  modelId: string,
  options: { temperature?: number } = {},
): BaseChatModel {
  const cached = llmCache.get(modelId);
  if (cached) return cached;

  const { provider } = getModelDefinition(modelId);
  const temperature = options.temperature ?? 0.4;

  let llm: BaseChatModel;

  switch (provider) {
    case 'google':
      llm = new ChatGoogleGenerativeAI({
        model: modelId,
        apiKey: process.env.GOOGLE_API_KEY,
        temperature,
      });
      break;

    case 'groq':
      llm = new ChatGroq({
        model: modelId,
        apiKey: process.env.GROQ_API_KEY,
        temperature,
      });
      break;

    case 'openrouter':
      llm = new ChatOpenAI({
        model: modelId,
        apiKey: process.env.OPENROUTER_API_KEY,
        temperature,
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

  llmCache.set(modelId, llm);
  return llm;
}

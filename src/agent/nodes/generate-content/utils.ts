import { Topic } from './generate-content.node';

export const CONTENT_BATCH_SIZE = 2;

export const REPAIR_ATTEMPTS = 2;

export const REQUIRED_SECTIONS = [
  'O que é',
  'Como funciona',
  'Exemplo prático',
  'Erros comuns',
  'Resumo do tópico',
];

export function findMissingSections(content?: string): string[] {
  if (!content || !content.trim()) return [...REQUIRED_SECTIONS];

  const normalized = content.toLowerCase();
  return REQUIRED_SECTIONS.filter(
    (section) => !normalized.includes(section.toLowerCase()),
  );
}

export function isValidTopicContent(content?: string): boolean {
  return findMissingSections(content).length === 0;
}

export class ContentValidationError extends Error {
  readonly invalidTopics: string[];

  constructor(invalidTopics: string[]) {
    super(
      `Conteudo incompleto apos ${REPAIR_ATTEMPTS} tentativas de reparo: ${invalidTopics.join(', ')}. Geração interrompida.`,
    );
    this.name = 'ContentValidationError';
    this.invalidTopics = invalidTopics;
  }
}

export function buildTopicsList(topics: Topic[]): string {
  return topics
    .map(
      (t) => `- id: ${t.id} | título: ${t.title} | descrição: ${t.description}`,
    )
    .join('\n');
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

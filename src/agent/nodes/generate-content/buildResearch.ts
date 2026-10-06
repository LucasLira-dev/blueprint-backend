import { DeepLearningStateType } from 'src/agent/state/deep-learning.state';
import { Topic } from './generate-content.node';

export function buildResearch(
  state: DeepLearningStateType,
  topics: Topic[],
): string {
  const allowed = new Set(topics.map((t) => t.id));
  const results = state.researchResults.filter((r) => allowed.has(r.topicId));

  if (!results.length) {
    return 'Nenhuma pesquisa disponível. Gere o conteúdo apenas com base na syllabus.';
  }

  return results
    .map((r) => {
      const sources = r.sources
        .map((s) => `    - ${s.title} (${s.url})`)
        .join('\n');
      return [
        `### ${r.topicId} — ${r.title}`,
        `Resumo: ${r.summary}`,
        `Pontos-chave:`,
        ...r.keyPoints.map((k) => `  - ${k}`),
        `Fontes:`,
        sources || '    - nenhuma',
      ].join('\n');
    })
    .join('\n\n');
}

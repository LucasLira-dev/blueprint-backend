import { Annotation } from '@langchain/langgraph';
import { DEFAULT_MODEL } from '../llm.factory';

export interface DeepTopic {
  id: string;
  title: string;
  description: string;
  content?: string;
}

export interface ResearchResult {
  topicId: string;
  title: string;
  summary: string;
  keyPoints: string[];
  sources: {
    title: string;
    url: string;
  }[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface EvaluationResult {
  approved: boolean;
  score: number;
  missingTopics: string[];
  feedback: string;
}

export const DeepLearningState = Annotation.Root({
  studyPlanId: Annotation<string>,
  topic: Annotation<string>,
  syllabus: Annotation<string>,
  topics: Annotation<DeepTopic[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  researchResults: Annotation<ResearchResult[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  researchStatus: Annotation<'success' | 'degraded' | 'failed'>({
    reducer: (_prev, next) => next,
    default: () => 'success',
  }),
  summary: Annotation<string>,
  evaluation: Annotation<EvaluationResult>,
  revisionCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  quiz: Annotation<QuizQuestion[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  model: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => DEFAULT_MODEL,
  }),
});

export type DeepLearningStateType = typeof DeepLearningState.State;

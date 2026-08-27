import { Annotation } from '@langchain/langgraph';
import { VideoResult } from 'src/youtube/youtube.service';
import { BookResult } from 'src/books/books.service';
import { DEFAULT_MODEL } from '../llm.factory';

export const StudyPlanState = Annotation.Root({
  topic: Annotation<string>,
  search: Annotation<{
    subject: string;
    intent: 'learn' | 'review' | 'practice' | 'understand' | 'other';
    level?: 'beginner' | 'intermediate' | 'advanced' | null;
    searchQuery?: string | null;
  }>({
    reducer: (_prev, next) => next,
    default: () => ({
      subject: '',
      intent: 'other',
      level: undefined,
      searchQuery: undefined,
    }),
  }),
  isAllowed: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  userId: Annotation<string>,
  videos: Annotation<VideoResult[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  books: Annotation<BookResult[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  syllabus: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  pdfUrl: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  model: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => DEFAULT_MODEL,
  }),
});

export type StudyPlanStateType = typeof StudyPlanState.State;

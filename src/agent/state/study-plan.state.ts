import { Annotation } from '@langchain/langgraph';
import { VideoResult } from 'src/youtube/youtube.service';
import { BookResult } from 'src/books/books.service';

export const StudyPlanState = Annotation.Root({
  topic: Annotation<string>,
  search: Annotation<{
    subject: string;
    intent: 'learn' | 'review' | 'practice' | 'understand' | 'other';
    level?: 'beginner' | 'intermediate' | 'advanced';
    searchQuery?: string;
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
  studyPlanId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
});

export type StudyPlanStateType = typeof StudyPlanState.State;

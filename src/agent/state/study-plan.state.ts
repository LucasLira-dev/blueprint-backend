import { Annotation } from '@langchain/langgraph';
import { VideoResult } from 'src/youtube/youtube.service';
import { BookResult } from 'src/books/books.service';

export const StudyPlanState = Annotation.Root({
  topic: Annotation<string>,
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

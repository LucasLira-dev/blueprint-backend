import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { BooksService } from 'src/books/books.service';
import { StudyPlanStateType } from '../state/study-plan.state';

export function buildFetchBooksNode(booksService: BooksService) {
  return async (state: StudyPlanStateType, config: LangGraphRunnableConfig) => {
    config.writer?.({
      step: 'fetchBooks',
      status: 'start',
      label: 'Buscando os 10 melhores livros sobre o tema...',
    });

    const books = await booksService.searchBooks(state.search.subject, 10);

    config.writer?.({
      step: 'fetchBooks',
      status: 'done',
      label: `Foram encontrados ${books.length} livros sobre o tema "${state.topic}".`,
    });

    return { books };
  };
}

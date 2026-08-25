import { Injectable, OnModuleInit } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { YoutubeService } from 'src/youtube/youtube.service';
import { BooksService } from 'src/books/books.service';
import { PdfService } from 'src/pdf/pdf.service';
import { StudyPlanStateType, StudyPlanState } from './state/study-plan.state';
import { buildGeneratePdfNode } from './nodes/generate-pdf.node';
import { buildFetchBooksNode } from './nodes/fetch-books.node';
import { buildFetchVideosNode } from './nodes/fetch-videos.node';
import { buildGenerateStudyPlanNode } from './nodes/generate-study-plan.node';
import { buildExtractSearchQueryNode } from './nodes/extract-search-query.node';
import { buildModerateTopicNode } from './nodes/moderate-topic.node';

@Injectable()
export class AgentService implements OnModuleInit {
  private checkpointer!: PostgresSaver;
  private app!: ReturnType<typeof this.compileGraph>;

  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly booksService: BooksService,
    private readonly pdfService: PdfService,
  ) {}

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    this.checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL);
    await this.checkpointer.setup();
    this.app = this.compileGraph();
  }

  private compileGraph() {
    const graph = new StateGraph(StudyPlanState)
      .addNode('extractSearchQuery', buildExtractSearchQueryNode())
      .addNode('fetchVideos', buildFetchVideosNode(this.youtubeService))
      .addNode('fetchBooks', buildFetchBooksNode(this.booksService))
      .addNode('generateStudyPlan', buildGenerateStudyPlanNode())
      .addNode('generatePdf', buildGeneratePdfNode(this.pdfService))
      .addNode('moderateTopic', buildModerateTopicNode());

    graph.addEdge(START, 'moderateTopic');
    graph.addConditionalEdges(
      'moderateTopic',
      (state: StudyPlanStateType) =>
        state.isAllowed ? 'extractSearchQuery' : END,
      ['extractSearchQuery', END],
    );
    graph.addEdge('extractSearchQuery', 'fetchVideos');
    graph.addEdge('extractSearchQuery', 'fetchBooks');
    graph.addEdge('fetchVideos', 'generateStudyPlan');
    graph.addEdge('fetchBooks', 'generateStudyPlan');
    graph.addEdge('generateStudyPlan', 'generatePdf');
    graph.addEdge('generatePdf', END);

    return graph.compile({ checkpointer: this.checkpointer });
  }

  async *streamGeneration(topic: string, userId: string, threadId: string) {
    const stream = await this.app.stream(
      {
        topic,
        userId,
      },
      {
        streamMode: 'custom',
        configurable: {
          thread_id: threadId,
        },
      },
    );

    for await (const event of stream) {
      yield event;
    }
  }

  async getFinalState(threadId: string) {
    const snapshot = await this.app.getState({
      configurable: { thread_id: threadId },
    });
    return snapshot.values as StudyPlanStateType;
  }

  getCheckpointer(): PostgresSaver {
    return this.checkpointer;
  }
}

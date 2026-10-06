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
import {
  DeepLearningState,
  DeepLearningStateType,
} from './state/deep-learning.state';
import { buildExtractTopicsNode } from './nodes/extract-topics.node';
import { buildResearchTopicsNode } from './nodes/research-topics.node';
import { buildGenerateContentNode } from './nodes/generate-content/generate-content.node';
import { buildEvaluationNode } from './nodes/evaluation.node';
import { buildGenerateQuizNode } from './nodes/generate-quiz.node';

const MAX_REVISIONS = 2;

@Injectable()
export class AgentService implements OnModuleInit {
  private checkpointer!: PostgresSaver;
  private app!: ReturnType<typeof this.compileGraph>;
  private deepApp!: ReturnType<typeof this.compileDeepGraph>;

  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly booksService: BooksService,
    private readonly pdfService: PdfService,
  ) {}

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    this.checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL, {
      schema: 'langgraph',
    });
    await this.checkpointer.setup();
    this.app = this.compileGraph();
    this.deepApp = this.compileDeepGraph();
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

  private compileDeepGraph() {
    const graph = new StateGraph(DeepLearningState)
      .addNode('extractTopics', buildExtractTopicsNode())
      .addNode('researchTopics', buildResearchTopicsNode())
      .addNode('generateContent', buildGenerateContentNode())
      .addNode('evaluateContent', buildEvaluationNode())
      .addNode('generateQuiz', buildGenerateQuizNode());

    graph.addEdge(START, 'extractTopics');
    graph.addEdge('extractTopics', 'researchTopics');
    graph.addEdge('researchTopics', 'generateContent');
    graph.addEdge('generateContent', 'evaluateContent');
    graph.addConditionalEdges(
      'evaluateContent',
      (state: DeepLearningStateType) =>
        state.evaluation.approved || state.revisionCount >= MAX_REVISIONS
          ? 'generateQuiz'
          : 'generateContent',
      ['generateContent', 'generateQuiz'],
    );
    graph.addEdge('generateQuiz', END);

    return graph.compile({ checkpointer: this.checkpointer });
  }

  async *streamGeneration(
    topic: string,
    userId: string,
    threadId: string,
    model?: string,
  ) {
    const stream = await this.app.stream(
      {
        topic,
        userId,
        model,
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

  async *streamDeepLearning(
    studyPlanId: string,
    topic: string,
    syllabus: string,
    threadId: string,
    model?: string,
  ) {
    const stream = await this.deepApp.stream(
      {
        studyPlanId,
        topic,
        syllabus,
        model,
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

  async getDeepFinalState(threadId: string) {
    const snapshot = await this.deepApp.getState({
      configurable: { thread_id: threadId },
    });
    return snapshot.values as DeepLearningStateType;
  }

  getCheckpointer(): PostgresSaver {
    return this.checkpointer;
  }
}

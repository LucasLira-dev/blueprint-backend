import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma.service';
import { AgentService } from 'src/agent/agent.service';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private agentService: AgentService,
  ) {}

  async getUserThreads(userId: string) {
    return this.prisma.studyPlan.findMany({
      where: {
        userId: userId,
        status: 'COMPLETED',
      },
      select: {
        id: true,
        topic: true,
        threadId: true,
        createdAt: true,
      },
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getThreadHistory(threadId: string, userId: string) {
    const thread = await this.prisma.studyPlan.findFirst({
      where: {
        threadId,
        userId,
        status: 'COMPLETED',
      },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const state = await this.agentService.getFinalState(threadId);
    const messages: ConversationMessage[] = [];

    if (state?.topic) {
      messages.push({ role: 'user', content: state.topic });
    }

    if (state?.syllabus) {
      messages.push({ role: 'assistant', content: state.syllabus });
    }

    return {
      messages,
    };
  }
}

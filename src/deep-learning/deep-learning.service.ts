import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepLearningStateType } from 'src/agent/state/deep-learning.state';
import { PrismaService } from 'prisma.service';

@Injectable()
export class DeepLearningService {
  constructor(private readonly prisma: PrismaService) {}

  async persistFinalDeepLearningState(
    userId: string,
    state: DeepLearningStateType,
    studyPlanId: string,
  ) {
    const studyPlan = await this.prisma.studyPlan.findFirst({
      where: {
        id: studyPlanId,
        userId,
      },
    });

    if (!studyPlan) {
      throw new BadRequestException(
        `Plano de estudo não encontrado para o usuário ${userId}`,
      );
    }

    // `DeepTopic.content` é obrigatório no banco: nunca gravar tópico vazio.
    const topics = state.topics.filter(
      (topic): topic is typeof topic & { content: string } =>
        typeof topic.content === 'string' && topic.content.trim().length > 0,
    );

    if (!topics.length) {
      throw new BadRequestException(
        `Nenhum tópico com conteúdo para salvar no plano ${studyPlanId}`,
      );
    }

    return this.prisma.deepLearningContent.create({
      data: {
        studyPlanId,
        title: state.topic,
        summary: state.summary,
        status: 'COMPLETED',
        topics: {
          create: topics.map((topic, index) => ({
            content: topic.content,
            title: topic.title,
            description: topic.description,
            slug: topic.id,
            order: index,
          })),
        },
        questions: {
          create: (state.quiz ?? []).map((question, index) => ({
            question: question.question,
            options: question.options,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            order: index,
          })),
        },
      },
    });
  }

  async getDeepLearningContentById(studyPlanId: string, userId: string) {
    return this.prisma.deepLearningContent.findFirst({
      where: {
        studyPlanId,
        studyPlan: {
          userId,
        },
      },
      include: {
        topics: {
          orderBy: { order: 'asc' },
        },
        questions: {
          orderBy: { order: 'asc' },
        },
        quizAttempts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async deleteDeepLearningContent(studyPlanId: string, userId: string) {
    const studyPlan = await this.prisma.studyPlan.findFirst({
      where: {
        id: studyPlanId,
        userId,
      },
    });

    if (!studyPlan) {
      throw new BadRequestException(
        `Plano de estudo não encontrado para o usuário ${userId}`,
      );
    }

    const deepLearningContent = await this.prisma.deepLearningContent.findFirst(
      {
        where: {
          studyPlanId,
        },
      },
    );

    if (!deepLearningContent) {
      throw new BadRequestException(
        `Conteúdo de aprendizado profundo não encontrado para o plano de estudo ${studyPlanId}`,
      );
    }

    return this.prisma.deepLearningContent.delete({
      where: {
        id: deepLearningContent.id,
      },
    });
  }
}

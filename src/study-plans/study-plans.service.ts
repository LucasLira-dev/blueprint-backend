import { BadRequestException, Injectable } from '@nestjs/common';
import { StudyPlanStateType } from 'src/agent/state/study-plan.state';
import { PrismaService } from 'src/prisma.service';
import { Visibility } from 'src/generated/prisma/enums';

@Injectable()
export class StudyPlansService {
  constructor(private prisma: PrismaService) {}

  async persistFinalState(
    userId: string,
    state: StudyPlanStateType,
    threadId: string,
  ) {
    return this.prisma.studyPlan.create({
      data: {
        userId,
        topic: state.topic,
        syllabus: state.syllabus,
        pdfUrl: state.pdfUrl,
        status: 'COMPLETED',
        threadId,
        videos: {
          create: state.videos.map((video) => ({
            title: video.title ?? '',
            videoUrl: video.videoUrl ?? '',
            thumbnail: video.thumbnail,
            channelName: video.channelName,
          })),
        },
        books: {
          create: state.books.map((book) => ({
            title: book.title ?? '',
            authors: book.authors ?? [],
            description: book.description,
            infoLink: book.infoLink,
            thumbnail: book.thumbnail,
          })),
        },
      },
      include: { books: true, videos: true },
    });
  }

  async getPlans(userId: string) {
    const studyPlans = await this.prisma.studyPlan.findMany({
      where: { userId },
      select: {
        id: true,
        topic: true,
        visibility: true,
        videos: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: { thumbnail: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return studyPlans.map((plan) => ({
      id: plan.id,
      topic: plan.topic,
      visibility: plan.visibility,
      thumbnail: plan.videos[0]?.thumbnail ?? null,
    }));
  }

  async getPlanById(planId: string, userId: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId, userId },
      select: {
        id: true,
        topic: true,
        syllabus: true,
        pdfUrl: true,
        visibility: true,
        videos: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            videoUrl: true,
            thumbnail: true,
            channelName: true,
          },
        },
        books: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            authors: true,
            thumbnail: true,
            infoLink: true,
            description: true,
          },
        },
      },
    });

    if (!plan) {
      throw new BadRequestException(
        'Plano de estudo não encontrado ou você não tem permissão para acessá-lo.',
      );
    }

    return plan;
  }

  async changeVisibility(
    planId: string,
    visibility: Visibility,
    userId: string,
  ) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId, userId },
    });

    if (!plan) {
      throw new BadRequestException(
        'Plano de estudo não encontrado ou você não tem permissão para alterá-lo.',
      );
    }

    return this.prisma.studyPlan.update({
      where: { id: planId },
      data: { visibility },
    });
  }
}

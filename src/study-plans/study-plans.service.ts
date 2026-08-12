import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { StudyPlanStateType } from 'src/agent/state/study-plan.state';
import { PrismaService } from '../../prisma.service';
import { Visibility } from 'src/generated/prisma/enums';
import { SupabaseStorageService } from 'src/storage/supabase-storage.service';

@Injectable()
export class StudyPlansService {
  constructor(
    private prisma: PrismaService,
    private supabaseStorageService: SupabaseStorageService,
  ) {}

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
            videoId: video.videoId ?? '',
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

  async getPublicPlans(userId: string) {
    const studyPlans = await this.prisma.studyPlan.findMany({
      where: { visibility: 'PUBLIC' },
      select: {
        id: true,
        topic: true,
        visibility: true,
        userId: true,
        user: {
          select: {
            name: true,
          },
        },
        videos: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: { thumbnail: true },
        },
        _count: {
          select: { favorites: true },
        },
        favorites: {
          where: { userId },
          select: { userId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalFavoritesByUser = await this.prisma.favoriteStudyPlan.count({
      where: { userId },
    });

    return {
      plans: studyPlans.map((plan) => ({
        id: plan.id,
        userName: plan.user.name,
        topic: plan.topic,
        visibility: plan.visibility,
        thumbnail: plan.videos[0]?.thumbnail ?? null,
        isFavorite: plan.favorites.length > 0,
        totalFavorites: plan._count.favorites,
      })),
      totalUserFavorites: totalFavoritesByUser,
    };
  }

  async getMyFavoritePlans(userId: string) {
    const favoritePlans = await this.prisma.favoriteStudyPlan.findMany({
      where: {
        userId,
        studyPlan: {
          OR: [{ visibility: 'PUBLIC' }, { userId: userId }],
        },
      },
      select: {
        studyPlan: {
          select: {
            id: true,
            topic: true,
            videos: {
              take: 1,
              orderBy: { createdAt: 'asc' },
              select: { thumbnail: true },
            },
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return favoritePlans.map((fav) => ({
      id: fav.studyPlan.id,
      topic: fav.studyPlan.topic,
      userName: fav.studyPlan.user.name,
      thumbnail: fav.studyPlan.videos[0]?.thumbnail ?? null,
    }));
  }

  async getPlanById(planId: string, userId: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId },
      select: {
        id: true,
        userId: true,
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
      throw new BadRequestException('Plano de estudo não encontrado.');
    }

    if (plan.visibility === 'PRIVATE' && plan.userId !== userId) {
      throw new UnauthorizedException(
        'Você não tem permissão para acessar este plano de estudo.',
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

  async changeFavorite(planId: string, favorite: boolean, userId: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId },
    });

    if (!plan) {
      throw new BadRequestException('Plano de estudo não encontrado.');
    }

    if (plan.visibility === 'PRIVATE' && plan.userId !== userId) {
      throw new UnauthorizedException(
        'Você não tem permissão para favoritar este plano de estudo.',
      );
    }

    if (favorite) {
      return this.prisma.favoriteStudyPlan.upsert({
        where: {
          userId_studyPlanId: {
            userId,
            studyPlanId: planId,
          },
        },
        create: {
          userId,
          studyPlanId: planId,
        },
        update: {},
      });
    } else {
      return this.prisma.favoriteStudyPlan.deleteMany({
        where: {
          userId,
          studyPlanId: planId,
        },
      });
    }
  }

  async deleteFavorite(planId: string, userId: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId },
    });

    if (!plan) {
      throw new BadRequestException('Plano de estudo não encontrado.');
    }

    await this.prisma.favoriteStudyPlan.deleteMany({
      where: {
        userId,
        studyPlanId: planId,
      },
    });

    return { message: 'Plano de estudo removido dos favoritos com sucesso.' };
  }

  async deleteAllFavoritesByUser(userId: string) {
    const favorites = await this.prisma.favoriteStudyPlan.findMany({
      where: { userId },
    });

    if (favorites.length === 0) {
      throw new BadRequestException(
        'Nenhum plano de estudo favorito encontrado para o usuário.',
      );
    }

    await this.prisma.favoriteStudyPlan.deleteMany({
      where: { userId },
    });

    return {
      message:
        'Todos os planos de estudo favoritos do usuário foram removidos com sucesso.',
    };
  }

  async deletePlan(planId: string, userId: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId },
    });

    if (!plan) {
      throw new BadRequestException('Plano de estudo não encontrado.');
    }

    if (plan.userId !== userId) {
      throw new UnauthorizedException(
        'Você não tem permissão para deletar este plano de estudo.',
      );
    }

    await this.prisma.studyPlan.delete({
      where: { id: planId },
    });

    await this.supabaseStorageService.deletePdf(plan.pdfUrl);

    return { message: 'Plano de estudo deletado com sucesso.' };
  }

  async deleteAllPlansByUser(userId: string) {
    const plans = await this.prisma.studyPlan.findMany({
      where: { userId },
    });

    if (plans.length === 0) {
      throw new BadRequestException(
        'Nenhum plano de estudo encontrado para o usuário.',
      );
    }

    await this.prisma.studyPlan.deleteMany({
      where: { userId },
    });

    for (const plan of plans) {
      await this.supabaseStorageService.deletePdf(plan.pdfUrl);
    }

    return {
      message:
        'Todos os planos de estudo do usuário foram deletados com sucesso.',
    };
  }
}

import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'prisma.service';
import { SupabaseStorageService } from 'src/storage/supabase-storage.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  async findAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
      },
    });
  }

  async findPlanDetails(planId: string) {
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
      throw new BadRequestException('Study plan not found');
    }
    return plan;
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.role === 'admin') {
      throw new UnauthorizedException('Cannot delete an admin user');
    }

    const plans = await this.prisma.studyPlan.findMany({
      where: { userId: id },
      select: {
        pdfUrl: true,
      },
    });

    for (const plan of plans) {
      await this.supabaseStorageService.deletePdf(plan.pdfUrl);
    }

    return this.prisma.user.delete({
      where: { id },
    });
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.studyPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new BadRequestException('Study plan not found');
    }

    await this.supabaseStorageService.deletePdf(plan.pdfUrl);

    return this.prisma.studyPlan.delete({
      where: { id },
    });
  }
}

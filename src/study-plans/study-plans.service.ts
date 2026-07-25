import { Injectable } from '@nestjs/common';
import { StudyPlanStateType } from 'src/agent/state/study-plan.state';
import { PrismaService } from 'src/prisma.service';

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
}

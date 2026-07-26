import { Controller, Get, Query, Res } from '@nestjs/common';
import { StudyPlansService } from './study-plans.service';
import { AgentService } from 'src/agent/agent.service';
import { type UserSession, Session } from '@thallesp/nestjs-better-auth';
import { type Response } from 'express';
import { randomUUID } from 'crypto';

@Controller('study-plans')
export class StudyPlansController {
  constructor(
    private readonly studyPlansService: StudyPlansService,
    private readonly agentService: AgentService,
  ) {}

  @Get('generate')
  async generate(
    @Query('topic') topic: string,
    @Session() session: UserSession,
    @Res() res: Response,
  ) {
    const userId = session.user.id;
    const threadId = randomUUID();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const event of this.agentService.streamGeneration(
        topic,
        userId,
        threadId,
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      const finalState = await this.agentService.getFinalState(threadId);

      if (!finalState.isAllowed) {
        res.end();
        return;
      }

      const saved = await this.studyPlansService.persistFinalState(
        userId,
        finalState,
        threadId,
      );

      res.write(
        `data: ${JSON.stringify({ step: 'done', status: 'done', label: 'Concluido', studyPlanId: saved.id, syllabus: saved.syllabus })}\n\n`,
      );
    } catch (error: any) {
      res.write(
        `data: ${JSON.stringify({
          step: 'error',
          status: 'error',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          label: error.message ?? 'Erro ao gerar o plano',
        })}\n\n`,
      );
    } finally {
      res.end();
    }
  }
}

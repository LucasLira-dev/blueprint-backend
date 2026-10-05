import {
  Controller,
  Get,
  Param,
  UseGuards,
  Query,
  Res,
  Delete,
} from '@nestjs/common';
import { DeepLearningService } from './deep-learning.service';
import { BetterAuthThrottlerGuard } from 'src/common/guards/user-throttler.guard';
import { Throttle } from '@nestjs/throttler';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { randomUUID } from 'crypto';
import { type Response } from 'express';
import { DEFAULT_MODEL, isModelAllowed } from 'src/agent/llm.factory';
import { AgentService } from 'src/agent/agent.service';
import { StudyPlansService } from 'src/study-plans/study-plans.service';

@Controller('deep-learning')
export class DeepLearningController {
  constructor(
    private readonly deepLearningService: DeepLearningService,
    private readonly agentService: AgentService,
    private readonly studyPlansService: StudyPlansService,
  ) {}

  @UseGuards(BetterAuthThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Get(':id/generate')
  async generate(
    @Param('id') id: string,
    @Query('model') model: string,
    @Session() session: UserSession,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = session.user.id;
    const threadId = randomUUID();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const modelId = model ?? DEFAULT_MODEL;

    if (!isModelAllowed(modelId)) {
      res.write(
        `data: ${JSON.stringify({
          step: 'error',
          status: 'error',
          label: `Modelo não suportado: ${modelId}`,
        })}\n\n`,
      );
      res.end();
      return;
    }

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': ping\n\n');
      }
    }, 15_000);

    try {
      const studyPlan = await this.studyPlansService.getPlanById(id, userId);

      for await (const event of this.agentService.streamDeepLearning(
        id,
        studyPlan.topic,
        studyPlan.syllabus,
        threadId,
        modelId,
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      const finalState = await this.agentService.getDeepFinalState(threadId);

      console.log('Final state of deep learning generation:', finalState);

      const saved =
        await this.deepLearningService.persistFinalDeepLearningState(
          userId,
          finalState,
          studyPlan.id,
        );

      res.write(
        `data: ${JSON.stringify({ step: 'done', status: 'done', label: 'Concluido', deepLearningContentId: saved.id, studyPlanId: saved.studyPlanId })}\n\n`,
      );
    } catch (error: any) {
      console.error('Erro ao gerar o plano de aprendizado:', error);
      res.write(
        `data: ${JSON.stringify({
          step: 'error',
          status: 'error',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          label: error.message ?? 'Erro ao gerar o plano',
        })}\n\n`,
      );
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  }

  @Get(':id/content')
  async getDeepLearningContent(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const userId = session.user.id;
    return this.deepLearningService.getDeepLearningContentById(id, userId);
  }

  @Delete(':id/content')
  async deleteDeepLearningContent(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const userId = session.user.id;
    return this.deepLearningService.deleteDeepLearningContent(id, userId);
  }
}

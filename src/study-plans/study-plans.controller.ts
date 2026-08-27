import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseBoolPipe,
  ParseEnumPipe,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { StudyPlansService } from './study-plans.service';
import { AgentService } from 'src/agent/agent.service';
import { type UserSession, Session } from '@thallesp/nestjs-better-auth';
import { type Response } from 'express';
import { randomUUID } from 'crypto';
import { BetterAuthThrottlerGuard } from 'src/common/guards/user-throttler.guard';
import { Throttle } from '@nestjs/throttler';
import { Visibility } from 'src/generated/prisma/enums';
import { isModelAllowed, DEFAULT_MODEL } from 'src/agent/llm.factory';

@Controller('study-plans')
export class StudyPlansController {
  constructor(
    private readonly studyPlansService: StudyPlansService,
    private readonly agentService: AgentService,
  ) {}

  @UseGuards(BetterAuthThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Get('generate')
  async generate(
    @Query('model') model: string,
    @Query('topic') topic: string,
    @Session() session: UserSession,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = session.user.id;
    const threadId = randomUUID();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

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

    try {
      for await (const event of this.agentService.streamGeneration(
        topic,
        userId,
        threadId,
        modelId,
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

  @Get('plans')
  async getPlans(
    @Query('userId') userId: string,
    @Session() session: UserSession,
  ) {
    if (userId && userId !== session.user.id) {
      if (session.user.role !== 'admin') {
        throw new ForbiddenException(
          'Apenas administradores podem visualizar planos de outros usuários.',
        );
      }
      return this.studyPlansService.getPlans(userId);
    }
    return this.studyPlansService.getPlans(session.user.id);
  }

  @Get('plans/my-favorites')
  async getMyFavoritePlans(@Session() session: UserSession) {
    return this.studyPlansService.getMyFavoritePlans(session.user.id);
  }

  @Get('plans/publics')
  async getPublicPlans(@Session() session: UserSession) {
    return this.studyPlansService.getPublicPlans(session.user.id);
  }

  @Get('plans/:id')
  async getPlanById(@Param('id') id: string, @Session() session: UserSession) {
    return this.studyPlansService.getPlanById(id, session.user.id);
  }

  @Patch('plans/:id/visibility')
  async changeVisibility(
    @Param('id') id: string,
    @Query('visibility', new ParseEnumPipe(Visibility)) visibility: Visibility,
    @Session() session: UserSession,
  ) {
    return this.studyPlansService.changeVisibility(
      id,
      visibility,
      session.user.id,
    );
  }

  @Patch('plans/:id/favorite')
  async changeFavorite(
    @Param('id') id: string,
    @Body('favorite', ParseBoolPipe) favorite: boolean,
    @Session() session: UserSession,
  ) {
    return this.studyPlansService.changeFavorite(id, favorite, session.user.id);
  }

  @Delete('plans/:id/removeFavorite')
  async removeFavorite(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.studyPlansService.deleteFavorite(id, session.user.id);
  }

  @Delete('plans/deleteAllFavorites')
  async deleteAllFavorites(@Session() session: UserSession) {
    return this.studyPlansService.deleteAllFavoritesByUser(session.user.id);
  }

  @Delete('plans/delete-all')
  async deleteAllPlans(@Session() session: UserSession) {
    return this.studyPlansService.deleteAllPlansByUser(session.user.id);
  }

  @Delete('plans/:id')
  async deletePlan(@Param('id') id: string, @Session() session: UserSession) {
    return this.studyPlansService.deletePlan(id, session.user.id);
  }
}

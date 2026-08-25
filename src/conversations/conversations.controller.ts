import { Controller, Get, Param } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get('my-threads')
  async getUserThreads(@Session() session: UserSession) {
    const userId = session.user.id;
    return this.conversationsService.getUserThreads(userId);
  }

  @Get(':threadId')
  async getThreadHistory(
    @Session() session: UserSession,
    @Param('threadId') threadId: string,
  ) {
    const history = await this.conversationsService.getThreadHistory(
      threadId,
      session.user.id,
    );
    return { threadId, ...history };
  }
}

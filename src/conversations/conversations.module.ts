import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { PrismaService } from 'prisma.service';
import { AgentModule } from 'src/agent/agent.module';

@Module({
  imports: [AgentModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, PrismaService],
  exports: [ConversationsService],
})
export class ConversationsModule {}

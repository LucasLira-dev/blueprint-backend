import { Module } from '@nestjs/common';
import { StudyPlansService } from './study-plans.service';
import { StudyPlansController } from './study-plans.controller';
import { PrismaService } from 'src/prisma.service';
import { AgentModule } from 'src/agent/agent.module';

@Module({
  imports: [AgentModule],
  controllers: [StudyPlansController],
  providers: [StudyPlansService, PrismaService],
})
export class StudyPlansModule {}

import { Module } from '@nestjs/common';
import { DeepLearningService } from './deep-learning.service';
import { DeepLearningController } from './deep-learning.controller';
import { AgentModule } from 'src/agent/agent.module';
import { StudyPlansModule } from 'src/study-plans/study-plans.module';
import { PrismaService } from 'prisma.service';

@Module({
  imports: [AgentModule, StudyPlansModule],
  controllers: [DeepLearningController],
  providers: [DeepLearningService, PrismaService],
})
export class DeepLearningModule {}

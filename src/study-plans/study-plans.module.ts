import { Module } from '@nestjs/common';
import { StudyPlansService } from './study-plans.service';
import { StudyPlansController } from './study-plans.controller';
import { PrismaService } from '../../prisma.service';
import { AgentModule } from 'src/agent/agent.module';
import { SupabaseStorageService } from 'src/storage/supabase-storage.service';

@Module({
  imports: [AgentModule],
  controllers: [StudyPlansController],
  providers: [StudyPlansService, PrismaService, SupabaseStorageService],
})
export class StudyPlansModule {}

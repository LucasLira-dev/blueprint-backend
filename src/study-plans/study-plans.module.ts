import { Module } from '@nestjs/common';
import { StudyPlansService } from './study-plans.service';
import { StudyPlansController } from './study-plans.controller';

@Module({
  controllers: [StudyPlansController],
  providers: [StudyPlansService],
})
export class StudyPlansModule {}

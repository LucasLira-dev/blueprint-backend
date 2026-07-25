import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StudyPlansService } from './study-plans.service';
import { CreateStudyPlanDto } from './dto/create-study-plan.dto';
import { UpdateStudyPlanDto } from './dto/update-study-plan.dto';

@Controller('study-plans')
export class StudyPlansController {
  constructor(private readonly studyPlansService: StudyPlansService) {}

  @Post()
  create(@Body() createStudyPlanDto: CreateStudyPlanDto) {
    return this.studyPlansService.create(createStudyPlanDto);
  }

  @Get()
  findAll() {
    return this.studyPlansService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studyPlansService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStudyPlanDto: UpdateStudyPlanDto) {
    return this.studyPlansService.update(+id, updateStudyPlanDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.studyPlansService.remove(+id);
  }
}

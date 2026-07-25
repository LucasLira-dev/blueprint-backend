import { Test, TestingModule } from '@nestjs/testing';
import { StudyPlansService } from './study-plans.service';

describe('StudyPlansService', () => {
  let service: StudyPlansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StudyPlansService],
    }).compile();

    service = module.get<StudyPlansService>(StudyPlansService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

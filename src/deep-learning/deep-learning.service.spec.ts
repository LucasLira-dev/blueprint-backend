import { Test, TestingModule } from '@nestjs/testing';
import { DeepLearningService } from './deep-learning.service';

describe('DeepLearningService', () => {
  let service: DeepLearningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeepLearningService],
    }).compile();

    service = module.get<DeepLearningService>(DeepLearningService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

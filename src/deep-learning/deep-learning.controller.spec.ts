import { Test, TestingModule } from '@nestjs/testing';
import { DeepLearningController } from './deep-learning.controller';
import { DeepLearningService } from './deep-learning.service';

describe('DeepLearningController', () => {
  let controller: DeepLearningController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeepLearningController],
      providers: [DeepLearningService],
    }).compile();

    controller = module.get<DeepLearningController>(DeepLearningController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

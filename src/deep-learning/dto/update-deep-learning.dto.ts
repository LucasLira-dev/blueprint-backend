import { PartialType } from '@nestjs/mapped-types';
import { CreateDeepLearningDto } from './create-deep-learning.dto';

export class UpdateDeepLearningDto extends PartialType(CreateDeepLearningDto) {}

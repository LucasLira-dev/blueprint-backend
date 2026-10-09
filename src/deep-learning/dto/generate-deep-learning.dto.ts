import { IsOptional, IsString } from 'class-validator';

export class GenerateDeepLearningDto {
  @IsOptional()
  @IsString()
  model?: string;
}

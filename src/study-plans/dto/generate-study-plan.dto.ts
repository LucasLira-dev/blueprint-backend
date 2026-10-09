import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateStudyPlanDto {
  @IsString()
  @IsNotEmpty()
  topic!: string;

  @IsOptional()
  @IsString()
  model?: string;
}

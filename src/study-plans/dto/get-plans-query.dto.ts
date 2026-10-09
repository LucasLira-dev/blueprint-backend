import { IsOptional, IsString } from 'class-validator';

export class GetPlansQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;
}

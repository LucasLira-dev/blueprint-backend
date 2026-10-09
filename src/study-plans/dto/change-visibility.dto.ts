import { IsEnum } from 'class-validator';
import { Visibility } from 'src/generated/prisma/enums';

export class ChangeVisibilityDto {
  @IsEnum(Visibility)
  visibility!: Visibility;
}

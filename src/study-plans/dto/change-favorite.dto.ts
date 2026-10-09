import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class ChangeFavoriteDto {
  @Transform(({ value }) => {
    const raw: unknown = value;
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return false;
    return raw;
  })
  @IsBoolean()
  favorite!: boolean;
}

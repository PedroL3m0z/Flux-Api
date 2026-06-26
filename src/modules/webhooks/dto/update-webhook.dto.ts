import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EVENT_TYPES } from '../../../core/telegram/services/telegram-events.service';

export class UpdateWebhookDto {
  @ApiPropertyOptional({ example: 'My integration' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/hooks/flux' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description:
      'Allow delivery to a private/loopback address (same Docker network / ' +
      'LAN). Cloud-metadata / link-local addresses are always blocked.',
  })
  @IsOptional()
  @IsBoolean()
  allowInternal?: boolean;

  @ApiPropertyOptional({ enum: EVENT_TYPES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(EVENT_TYPES, { each: true })
  events?: string[];
}

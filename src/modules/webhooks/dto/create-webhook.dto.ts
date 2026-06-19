import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EVENT_TYPES } from '../../../core/telegram/services/telegram-events.service';

export class CreateWebhookDto {
  @ApiProperty({ example: 'My integration' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'https://example.com/hooks/flux' })
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty({ enum: EVENT_TYPES, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(EVENT_TYPES, { each: true })
  events!: string[];

  @ApiPropertyOptional({ type: [String], description: 'Instance ids to link' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instanceIds?: string[];
}

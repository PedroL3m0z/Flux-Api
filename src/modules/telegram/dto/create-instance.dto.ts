import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ENGINE_KEYS,
  type EngineKey,
} from '../../../core/telegram/engines/engine.types';

export class CreateInstanceDto {
  @ApiProperty({ example: 'Main account' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  label!: string;

  @ApiPropertyOptional({ enum: ENGINE_KEYS, default: 'gramjs' })
  @IsOptional()
  @IsIn(ENGINE_KEYS)
  engine?: EngineKey;

  @ApiPropertyOptional({ description: 'GramJS api_id (from my.telegram.org)' })
  @IsOptional()
  @IsNumberString()
  apiId?: string;

  @ApiPropertyOptional({
    description: 'GramJS api_hash (from my.telegram.org)',
  })
  @IsOptional()
  @IsString()
  apiHash?: string;
}

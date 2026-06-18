import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
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

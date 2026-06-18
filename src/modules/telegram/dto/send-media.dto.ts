import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMediaDto {
  @ApiPropertyOptional({ example: 'Look at this' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;
}

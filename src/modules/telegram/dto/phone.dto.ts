import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class PhoneDto {
  @ApiProperty({
    description: 'Phone number in international format (e.g. +5511999999999)',
    example: '+5511999999999',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be in international format, e.g. +5511999999999',
  })
  phone!: string;
}

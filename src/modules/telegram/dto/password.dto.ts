import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class PasswordDto {
  @ApiProperty({ description: 'Telegram 2FA password' })
  @IsString()
  @MinLength(1)
  password!: string;
}

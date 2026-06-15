import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'flux_user', description: 'username or email' })
  @IsString()
  username!: string;

  @ApiProperty({ example: 'S3cureP@ss' })
  @IsString()
  @MinLength(8)
  password!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@flux.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'flux_user' })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  username!: string;

  @ApiProperty({ example: 'S3cureP@ss', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

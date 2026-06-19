import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class PhoneCodeDto {
  @ApiProperty({
    description: 'Login code received via Telegram app or SMS',
    example: '12345',
  })
  @IsString()
  @Matches(/^\d{5,6}$/, { message: 'code must be 5–6 digits' })
  code!: string;
}

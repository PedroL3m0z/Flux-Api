import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PhoneLoginStepEntity {
  @ApiProperty({ enum: ['password_required', 'authorized'] })
  status!: 'password_required' | 'authorized';

  @ApiPropertyOptional({
    description: 'Present when status is authorized',
    example: { id: '123456789', username: 'me', firstName: 'Me' },
  })
  me?: { id: string; username?: string; firstName?: string; phone?: string };
}

export class LoginPasswordResponseEntity {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiPropertyOptional({
    description:
      'Present when a phone login completes after submitting 2FA password',
  })
  me?: { id: string; username?: string; firstName?: string; phone?: string };
}

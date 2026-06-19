import { ApiProperty } from '@nestjs/swagger';

/** Safe user representation — never includes the password hash. */
export class UserEntity {
  @ApiProperty({ example: 'ckuser0001' })
  id!: string;

  @ApiProperty({ example: 'admin@flux.local' })
  email!: string;

  @ApiProperty({ example: 'admin' })
  username!: string;

  @ApiProperty({
    enum: ['admin', 'member'],
    example: 'member',
    description: 'Global role',
  })
  role!: 'admin' | 'member';
}

/** Login response. The JWT is also set as an httpOnly cookie. */
export class LoginResponseEntity {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
    description: 'Signed JWT access token',
  })
  accessToken!: string;
}

/** Generic acknowledgement payload. */
export class OkResponseEntity {
  @ApiProperty({ example: true })
  ok!: boolean;
}

import { ApiProperty } from '@nestjs/swagger';

const INSTANCE_ROLES = ['owner', 'operator', 'viewer'] as const;

/** A user granted access to an instance. */
export class InstanceMemberEntity {
  @ApiProperty({ example: 'ckuser0001' })
  userId!: string;

  @ApiProperty({ example: 'jane' })
  username!: string;

  @ApiProperty({ example: 'jane@flux.local' })
  email!: string;

  @ApiProperty({ enum: INSTANCE_ROLES, example: 'operator' })
  role!: (typeof INSTANCE_ROLES)[number];

  @ApiProperty({ format: 'date-time', example: '2026-06-19T12:00:00.000Z' })
  createdAt!: string;
}

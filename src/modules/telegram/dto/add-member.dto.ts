import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import type { InstanceRole } from '../../../common/authz/permissions';

const INSTANCE_ROLES: InstanceRole[] = ['owner', 'operator', 'viewer'];

export class AddMemberDto {
  @ApiProperty({ description: 'Id of the user to grant access to' })
  @IsString()
  userId!: string;

  @ApiProperty({
    enum: INSTANCE_ROLES,
    example: 'operator',
    description: 'Role to grant on this instance',
  })
  @IsIn(INSTANCE_ROLES)
  role!: InstanceRole;
}

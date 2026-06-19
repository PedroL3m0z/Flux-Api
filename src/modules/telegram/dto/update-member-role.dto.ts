import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { InstanceRole } from '../../../common/authz/permissions';

const INSTANCE_ROLES: InstanceRole[] = ['owner', 'operator', 'viewer'];

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: INSTANCE_ROLES, example: 'operator' })
  @IsIn(INSTANCE_ROLES)
  role!: InstanceRole;
}

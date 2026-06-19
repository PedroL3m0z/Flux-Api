import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { UserRole } from '../../../common/authz/permissions';

const ROLES: UserRole[] = ['admin', 'operator', 'viewer'];

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ROLES, example: 'operator' })
  @IsIn(ROLES)
  role!: UserRole;
}

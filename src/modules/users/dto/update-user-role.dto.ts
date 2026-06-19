import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { GlobalRole } from '../../../common/authz/permissions';

const ROLES: GlobalRole[] = ['admin', 'member'];

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ROLES, example: 'admin' })
  @IsIn(ROLES)
  role!: GlobalRole;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { UserRole } from '../../../common/authz/permissions';

const ROLES: UserRole[] = ['admin', 'operator', 'viewer'];

/** Admin edit of a user. Every field is optional; only sent fields change. */
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'user@flux.dev' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'flux_user' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  username?: string;

  @ApiPropertyOptional({ example: 'S3cureP@ss', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ enum: ROLES, example: 'operator' })
  @IsOptional()
  @IsIn(ROLES)
  role?: UserRole;
}

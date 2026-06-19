import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/authz/roles.decorator';
import { RolesGuard } from '../../common/authz/roles.guard';
import { UserEntity } from '../auth/entities/auth.entity';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@ApiSecurity('api-key')
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all registered users' })
  @ApiOkResponse({ type: [UserEntity] })
  findAll() {
    return this.users.findAll();
  }

  @Patch(':id/role')
  @Roles('admin')
  @ApiOperation({
    summary: "Set a user's global role (admin only)",
    description:
      'Promotes or demotes a user between admin and member. Admins have full access to every instance and can manage users.',
  })
  @ApiParam({ name: 'id', description: 'User id' })
  @ApiOkResponse({ type: UserEntity })
  @ApiForbiddenResponse({ description: 'Requires the admin role' })
  setRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.users.setRole(id, dto.role);
  }
}

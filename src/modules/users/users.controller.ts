import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/authz/roles.decorator';
import { RolesGuard } from '../../common/authz/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { SafeUser } from '../auth/auth.service';
import { UserEntity } from '../auth/entities/auth.entity';
import { UpdateUserDto } from './dto/update-user.dto';
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
  @Roles('admin')
  @ApiOperation({ summary: 'List all registered users (admin only)' })
  @ApiOkResponse({ type: [UserEntity] })
  @ApiForbiddenResponse({ description: 'Requires the admin role' })
  findAll() {
    return this.users.findAll();
  }

  @Patch(':id/role')
  @Roles('admin')
  @ApiOperation({
    summary: "Set a user's global role (admin only)",
    description:
      'Sets the global dashboard role: admin (full access + user management), operator (manage instances, send messages, webhooks), or viewer (read-only).',
  })
  @ApiParam({ name: 'id', description: 'User id' })
  @ApiOkResponse({ type: UserEntity })
  @ApiForbiddenResponse({ description: 'Requires the admin role' })
  @ApiBadRequestResponse({ description: 'Cannot change your own role' })
  setRole(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    if (user.id === id) {
      throw new BadRequestException('Cannot change your own role');
    }
    return this.users.setRole(id, dto.role);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({
    summary: 'Edit a user (admin only)',
    description:
      'Updates any of email, username, password or role. Only provided fields change.',
  })
  @ApiParam({ name: 'id', description: 'User id' })
  @ApiOkResponse({ type: UserEntity })
  @ApiForbiddenResponse({ description: 'Requires the admin role' })
  @ApiBadRequestResponse({ description: 'Cannot change your own role' })
  update(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    if (user.id === id && dto.role !== undefined && dto.role !== user.role) {
      throw new BadRequestException('Cannot change your own role');
    }
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a user (admin only)',
    description:
      'Permanently deletes a user and cascades their instances and webhooks. You cannot delete your own account.',
  })
  @ApiParam({ name: 'id', description: 'User id' })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiForbiddenResponse({ description: 'Requires the admin role' })
  @ApiBadRequestResponse({ description: 'Cannot delete your own account' })
  async remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    if (user.id === id) {
      throw new BadRequestException('Cannot delete your own account');
    }
    await this.users.remove(id);
  }
}

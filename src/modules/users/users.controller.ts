import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (JWT protected)' })
  findAll() {
    return this.users.findAll();
  }
}

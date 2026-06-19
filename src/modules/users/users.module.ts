import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/authz/roles.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
  exports: [UsersService],
})
export class UsersModule {}

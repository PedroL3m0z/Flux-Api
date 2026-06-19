import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/authz/roles.guard';
import { HashingService } from '../../common/hashing/hashing.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, HashingService, RolesGuard],
  exports: [UsersService],
})
export class UsersModule {}

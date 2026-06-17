import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { SeedService } from './seed.service';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [SeedService],
})
export class SeedModule {}

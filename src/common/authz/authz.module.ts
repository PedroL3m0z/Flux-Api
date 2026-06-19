import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { InstanceAccessGuard } from './instance-access.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  providers: [AccessService, InstanceAccessGuard, RolesGuard],
  exports: [AccessService, InstanceAccessGuard, RolesGuard],
})
export class AuthzModule {}

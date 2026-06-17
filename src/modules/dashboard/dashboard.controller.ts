import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Redirects the root path to the dashboard SPA. The static files themselves are
 * served by ServeStaticModule under /dashboard; this just gives `/` a home.
 */
@Controller()
export class DashboardController {
  @Get()
  @Public()
  @Redirect('/dashboard', 302)
  @ApiExcludeEndpoint()
  root(): void {}
}

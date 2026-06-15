import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Extracts the user attached to the request by the auth guards. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

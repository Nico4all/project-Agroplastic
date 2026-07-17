import { UserRole } from '@prisma/client';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthenticatedUser = {
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  city?: string | null;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { auth } from 'src/lib/auth';

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: any }>();

    try {
      const session = await auth.api.getSession({
        headers: request.headers as Record<string, string>,
      });

      if (!session || !session.user) {
        throw new UnauthorizedException('User is not authenticated');
      }

      const userRole = session.user.role;

      if (userRole !== 'admin') {
        throw new ForbiddenException('User does not have admin privileges');
      }

      request.user = session.user;

      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new UnauthorizedException('User is not authenticated');
    }
  }
}

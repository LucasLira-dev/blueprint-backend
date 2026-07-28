/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core/services/reflector.service';
import {
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { type UserSession } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';

@Injectable()
export class BetterAuthThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly authService: AuthService,
  ) {
    super(options, storage, reflector);
  }

  protected async getTracker(req: any): Promise<string> {
    try {
      const session: UserSession | null = await this.authService.api.getSession(
        {
          headers: fromNodeHeaders(req.headers),
        },
      );

      const userId = session?.user.id;

      if (userId) {
        return `user-${userId}`;
      }
    } catch {
      // Session not available, fall back to IP
      return super.getTracker(req);
    }

    return super.getTracker(req);
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new (await import('@nestjs/common')).HttpException(
      'Você atingiu o limite de gerações. Tente novamente mais tarde.',
      429,
    );
  }
}

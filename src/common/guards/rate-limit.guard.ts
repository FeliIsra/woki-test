import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

interface RequestEntry {
  timestamps: number[];
}

/**
 * Simple sliding-window rate limiter keyed by client IP (B9 requirement).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, RequestEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(private readonly configService: ConfigService) {
    this.windowMs =
      this.configService.get<number>('app.rateLimit.windowMs') ?? 60_000;
    this.maxRequests =
      this.configService.get<number>('app.rateLimit.max') ?? 100;
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const ip = request.ip ?? request.headers['x-forwarded-for']?.toString() ?? 'unknown';
    const now = Date.now();
    const entry = this.requests.get(ip) ?? { timestamps: [] };

    entry.timestamps = entry.timestamps.filter(
      (timestamp) => now - timestamp <= this.windowMs
    );

    if (entry.timestamps.length >= this.maxRequests) {
      const retryAfterSec = Math.ceil(this.windowMs / 1000);
      // Communicate backoff window via standard header before failing hard.
      response.setHeader('Retry-After', retryAfterSec.toString());
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    entry.timestamps.push(now);
    this.requests.set(ip, entry);
    return true;
  }
}

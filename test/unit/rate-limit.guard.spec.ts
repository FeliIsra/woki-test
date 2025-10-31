import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RateLimitGuard } from '@/common/guards/rate-limit.guard';

const createContext = (ip = '127.0.0.1') => {
  const responseHeaders: Record<string, string> = {};
  const request = { ip, headers: {} } as unknown as Request;
  const response = {
    headers: responseHeaders,
    setHeader: jest.fn((key: string, value: string) => {
      responseHeaders[key] = value;
    })
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response
    })
  } as unknown as ExecutionContext;
};

const createConfigService = (): ConfigService =>
  ({
    get: (key: string) => {
      if (key === 'app.rateLimit.windowMs') {
        return 1_000;
      }
      if (key === 'app.rateLimit.max') {
        return 2;
      }
      return undefined;
    }
  }) as unknown as ConfigService;

describe('RateLimitGuard', () => {
  it('allows requests within the configured rate limit', () => {
    const guard = new RateLimitGuard(createConfigService());
    const context = createContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects requests exceeding the configured threshold and sets retry header', () => {
    const guard = new RateLimitGuard(createConfigService());
    const context = createContext();

    guard.canActivate(context);
    guard.canActivate(context);
    expect(() => guard.canActivate(context)).toThrow('Too many requests');

    const response = context.switchToHttp().getResponse() as { headers: Record<string, string> };
    expect(response.headers['Retry-After']).toBe('1');
  });

  it('uses separate buckets per IP address', () => {
    const guard = new RateLimitGuard(createConfigService());
    const firstContext = createContext('10.0.0.1');
    const secondContext = createContext('10.0.0.2');

    guard.canActivate(firstContext);
    guard.canActivate(firstContext);
    expect(() => guard.canActivate(firstContext)).toThrow(HttpException);

    expect(guard.canActivate(secondContext)).toBe(true);
    expect(guard.canActivate(secondContext)).toBe(true);
  });
});


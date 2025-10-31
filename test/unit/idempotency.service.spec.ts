import { ConfigService } from '@nestjs/config';

import { IdempotencyService } from '@/store/idempotency.service';

const createConfigService = (): ConfigService =>
  ({
    get: (key: string) => {
      if (key === 'app.bookings.idempotencyTtlMs') {
        return 1_000;
      }
      if (key === 'app.bookings.persistentTtlMs') {
        return 5_000;
      }
      return undefined;
    }
  }) as unknown as ConfigService;

describe('IdempotencyService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2024-01-01T00:00:00.000Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores values in both ephemeral and persistent caches', () => {
    const service = new IdempotencyService(createConfigService());

    service.set('key', { value: 42 });
    expect(service.has('key')).toBe(true);
    expect(service.get('key')).toEqual({ value: 42 });

    jest.advanceTimersByTime(2_000);
    expect(service.get('key')).toEqual({ value: 42 });

    jest.advanceTimersByTime(4_000);
    expect(service.get('key')).toBeUndefined();
  });

  it('cleanup removes expired records from both stores', () => {
    const service = new IdempotencyService(createConfigService());
    service.set('key', 'value');

    jest.advanceTimersByTime(6_000);
    service.cleanup();

    expect(service.has('key')).toBe(false);
  });
});


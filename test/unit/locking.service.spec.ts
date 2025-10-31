import { LockingService } from '@/store/locking.service';

const flushImmediate = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('LockingService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('queues contenders and releases them in FIFO order', async () => {
    const service = new LockingService();

    const releaseFirst = await service.acquire('resource');
    let releaseSecond: (() => void) | undefined;
    const second = service.acquire('resource').then((release) => {
      releaseSecond = release;
      return release;
    });

    await flushImmediate();
    expect(releaseSecond).toBeUndefined();
    expect(service.getWaitingCount('resource')).toBe(1);

    releaseFirst();
    await flushImmediate();
    await second;

    expect(releaseSecond).toBeDefined();
    expect(service.getWaitingCount('resource')).toBe(0);

    releaseSecond?.();
    await flushImmediate();
    service.onModuleDestroy();
  });

  it('treats locks as stale after timeout and allows new acquisition', async () => {
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    const service = new LockingService();

    await service.acquire('resource');

    now = 11_000; // beyond 10s timeout
    const release = await service.acquire('resource');
    expect(typeof release).toBe('function');

    release();
    nowSpy.mockRestore();
    service.onModuleDestroy();
  });

  it('cleans up idle semaphore entries when invoked', async () => {
    const service = new LockingService();
    const release = await service.acquire('resource');
    release();
    await flushImmediate();

    (service as unknown as { cleanupStaleLocks: () => void }).cleanupStaleLocks();
    expect((service as unknown as { semaphores: Map<string, unknown> }).semaphores.size).toBe(0);

    service.onModuleDestroy();
  });
});

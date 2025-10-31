import { Injectable, OnModuleDestroy } from '@nestjs/common';

type ReleaseFn = () => void;

interface SemaphoreEntry {
  locked: boolean;
  queue: Array<() => void>;
  timestamp: number;
}

/**
 * Lightweight async semaphore keyed by booking scope. Ensures we serialize conflicting
 * create requests without involving external infrastructure.
 */
@Injectable()
export class LockingService implements OnModuleDestroy {
  private readonly semaphores = new Map<string, SemaphoreEntry>();
  private readonly lockTimeoutMs = 10_000;
  // Periodically prune stale semaphore entries to avoid long-lived memory growth in the process.
  private readonly cleanupInterval = setInterval(
    () => this.cleanupStaleLocks(),
    30_000
  );

  async acquire(key: string): Promise<ReleaseFn> {
    const entry = this.getOrCreateEntry(key);
    const now = Date.now();

    if (entry.locked && now - entry.timestamp > this.lockTimeoutMs) {
      // stale lock, release it
      entry.locked = false;
      entry.queue = [];
    }

    return new Promise<ReleaseFn>((resolve) => {
      const attempt = () => {
        entry.locked = true;
        entry.timestamp = Date.now();
        resolve(() => this.release(key));
      };

      if (!entry.locked) {
        attempt();
        return;
      }

      entry.queue.push(attempt);
    });
  }

  release(key: string): void {
    const entry = this.semaphores.get(key);
    if (!entry) {
      return;
    }

    const next = entry.queue.shift();
    if (next) {
      // schedule next to avoid stack growth
      setImmediate(next);
      return;
    }

    entry.locked = false;
    entry.timestamp = Date.now();
  }

  getWaitingCount(key: string): number {
    const entry = this.semaphores.get(key);
    return entry?.queue.length ?? 0;
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }

  clear(): void {
    this.semaphores.clear();
  }

  private getOrCreateEntry(key: string): SemaphoreEntry {
    if (!this.semaphores.has(key)) {
      this.semaphores.set(key, {
        locked: false,
        queue: [],
        timestamp: Date.now()
      });
    }
    return this.semaphores.get(key)!;
  }

  private cleanupStaleLocks(): void {
    const now = Date.now();
    for (const [key, entry] of this.semaphores.entries()) {
      if (!entry.locked && entry.queue.length === 0) {
        this.semaphores.delete(key);
        continue;
      }
      if (entry.locked && now - entry.timestamp > this.lockTimeoutMs) {
        entry.locked = false;
        entry.queue = [];
        this.semaphores.delete(key);
      }
    }
  }
}

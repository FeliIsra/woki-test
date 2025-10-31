import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

interface IdempotencyRecord<T> {
  value: T;
  expiresAt: number;
}

/**
 * Keeps short-lived (60s) and longer-lived (24h) caches to honor HTTP idempotency semantics.
 */
@Injectable()
export class IdempotencyService<T = unknown> {
  private readonly store = new Map<string, IdempotencyRecord<T>>();
  private readonly persistentStore = new Map<string, IdempotencyRecord<T>>();

  private readonly ttlMs: number;
  private readonly persistentTtlMs: number;

  constructor(private readonly configService: ConfigService) {
    this.ttlMs =
      this.configService.get<number>('app.bookings.idempotencyTtlMs') ?? 60_000;
    this.persistentTtlMs =
      this.configService.get<number>('app.bookings.persistentTtlMs') ??
      86_400_000;
  }

  get(key: string): T | undefined {
    const now = Date.now();
    const ephemeral = this.store.get(key);
    if (ephemeral) {
      if (ephemeral.expiresAt > now) {
        return ephemeral.value;
      }
      this.store.delete(key);
    }

    const persistent = this.persistentStore.get(key);
    if (persistent) {
      // If the short-lived cache expired, fall back to the 24h persistence window.
      if (persistent.expiresAt > now) {
        return persistent.value;
      }
      this.persistentStore.delete(key);
    }
    return undefined;
  }

  set(key: string, value: T): void {
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + this.ttlMs
    });
    this.persistentStore.set(key, {
      // Mirror the value into the longer-term map so reruns days apart still return same payload.
      value,
      expiresAt: now + this.persistentTtlMs
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  // Background janitor to release expired entries and keep memory bounded.
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.expiresAt <= now) {
        this.store.delete(key);
      }
    }
    for (const [key, record] of this.persistentStore.entries()) {
      if (record.expiresAt <= now) {
        this.persistentStore.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
    this.persistentStore.clear();
  }
}

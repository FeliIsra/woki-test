import { registerAs } from '@nestjs/config';

export interface DurationByPartySizeConfig {
  [partySize: number]: number;
  default: number;
}

// Default dining durations (B1) keyed by party size, with a fallback for anything unspecified.
const DURATION_BY_PARTY_SIZE: DurationByPartySizeConfig = {
  2: 75,
  4: 90,
  8: 120,
  default: 90
};

export default registerAs('app', () => {
  const port = Number(process.env.APP_PORT ?? process.env.PORT ?? 4000);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 100);
  const largeGroupThreshold = Number(process.env.LARGE_GROUP_THRESHOLD ?? 8);
  const waitlistCheckIntervalMs = Number(
    process.env.WAITLIST_CHECK_INTERVAL_MS ?? 300_000
  );
  const corsEnabled = process.env.CORS_ENABLED !== 'false';
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const corsMethods = process.env.CORS_METHODS ?? 'GET,HEAD,PUT,PATCH,POST,DELETE';
  const corsAllowCredentials = process.env.CORS_ALLOW_CREDENTIALS !== 'false';

  // Central configuration object consumed throughout the Nest container.
  return {
    port,
    log: {
      level: process.env.LOG_LEVEL ?? 'info'
    },
    capacityStrategy: process.env.CAPACITY_STRATEGY ?? 'simple',
    rateLimit: {
      windowMs: rateLimitWindowMs,
      max: rateLimitMax
    },
    durations: DURATION_BY_PARTY_SIZE,
    largeGroupThreshold,
    waitlistCheckIntervalMs,
    approvalTtlMs: 86_400_000,
    bookings: {
      idempotencyTtlMs: 60_000,
      persistentTtlMs: 86_400_000
    },
    repack: {
      maxTablesPerCombo: 4
    },
    waitlist: {
      ttlMs: 3_600_000
    },
    cors: {
      enabled: corsEnabled,
      origins: corsOrigins,
      methods: corsMethods,
      allowCredentials: corsAllowCredentials
    }
  };
});

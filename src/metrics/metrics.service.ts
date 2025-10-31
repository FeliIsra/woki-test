import { Injectable } from '@nestjs/common';
import {
  Counter,
  Registry,
  Summary,
  collectDefaultMetrics
} from 'prom-client';

/**
 * Prometheus-friendly metrics facade that tracks booking throughput and contention stats.
 */
@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly bookingsCreatedCounter: Counter;
  private readonly bookingsCancelledCounter: Counter;
  private readonly conflictsCounter: Counter;
  private readonly lockContentionCounter: Counter;
  private readonly assignmentDurationSummary: Summary;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

    this.bookingsCreatedCounter = new Counter({
      name: 'bookings_created_total',
      help: 'Total number of bookings successfully created',
      registers: [this.registry]
    });

    this.bookingsCancelledCounter = new Counter({
      name: 'bookings_cancelled_total',
      help: 'Total number of bookings cancelled',
      registers: [this.registry]
    });

    this.conflictsCounter = new Counter({
      name: 'conflicts_total',
      help: 'Total number of booking conflicts detected',
      registers: [this.registry]
    });

    this.lockContentionCounter = new Counter({
      name: 'lock_contention_total',
      help: 'Total number of lock contention events',
      registers: [this.registry]
    });

    this.assignmentDurationSummary = new Summary({
      name: 'wokibrain_assignment_duration_ms',
      help: 'Duration of WokiBrain assignment in milliseconds',
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry]
    });
  }

  incrementBookingsCreated(): void {
    this.bookingsCreatedCounter.inc();
  }

  incrementBookingsCancelled(): void {
    this.bookingsCancelledCounter.inc();
  }

  incrementConflicts(): void {
    this.conflictsCounter.inc();
  }

  incrementLockContention(count = 1): void {
    this.lockContentionCounter.inc(count);
  }

  observeAssignmentDuration(durationMs: number): void {
    this.assignmentDurationSummary.observe(durationMs);
  }

  async serialize(): Promise<string> {
    // Called by the /metrics endpoint to expose the Prometheus exposition format.
    return this.registry.metrics();
  }
}

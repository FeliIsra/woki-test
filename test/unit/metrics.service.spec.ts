import { MetricsService } from '@/metrics/metrics.service';

describe('MetricsService', () => {
  it('records counters and summaries and returns Prometheus exposition', async () => {
    const service = new MetricsService();

    service.incrementBookingsCreated();
    service.incrementBookingsCancelled();
    service.incrementConflicts();
    service.incrementLockContention(3);
    service.observeAssignmentDuration(125);

    const output = await service.serialize();

    expect(output).toContain('bookings_created_total 1');
    expect(output).toContain('bookings_cancelled_total 1');
    expect(output).toContain('conflicts_total 1');
    expect(output).toContain('lock_contention_total 3');
    expect(output).toContain('wokibrain_assignment_duration_ms');
  });
});


import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';

import { MetricsService } from './metrics.service';

/**
 * Exposes the Prometheus scrape endpoint.
 */
@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Expose Prometheus metrics' })
  @ApiProduces('text/plain')
  @ApiOkResponse({ description: 'Prometheus exposition format payload', schema: { type: 'string' } })
  async getMetrics(): Promise<string> {
    // Called by the /metrics endpoint to expose the Prometheus exposition format.
    return this.metricsService.serialize();
  }
}

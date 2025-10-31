import { ApiProperty } from '@nestjs/swagger';

import type { DiscoveryView, DiscoveryViewCandidate } from '../booking.service';

export class DiscoveryViewCandidateDto implements DiscoveryViewCandidate {
  @ApiProperty({ description: 'Candidate tables that can satisfy the request', example: ['table-1', 'table-2'] })
  tableIds!: string[];

  @ApiProperty({ description: 'Proposed start time in ISO format', example: '2025-06-01T12:00:00.000Z' })
  start!: string;

  @ApiProperty({ description: 'Derived end time in ISO format', example: '2025-06-01T13:30:00.000Z' })
  end!: string;

  @ApiProperty({
    description: 'Capacity range yielded by the configured strategy',
    example: { min: 4, max: 6 }
  })
  capacity!: { min: number; max: number };

  static from(candidate: DiscoveryViewCandidate): DiscoveryViewCandidateDto {
    const dto = new DiscoveryViewCandidateDto();
    dto.tableIds = candidate.tableIds;
    dto.start = candidate.start as string;
    dto.end = candidate.end as string;
    dto.capacity = candidate.capacity;
    return dto;
  }
}

export class DiscoveryViewDto implements DiscoveryView {
  @ApiProperty({ enum: ['success', 'no_capacity'], description: 'Outcome of the discovery attempt' })
  outcome!: 'success' | 'no_capacity';

  @ApiProperty({ description: 'First viable candidate ordered by start time and capacity', type: DiscoveryViewCandidateDto, required: false })
  candidate?: DiscoveryViewCandidateDto;

  static from(view: DiscoveryView): DiscoveryViewDto {
    const dto = new DiscoveryViewDto();
    dto.outcome = view.outcome;
    dto.candidate = view.candidate ? DiscoveryViewCandidateDto.from(view.candidate) : undefined;
    return dto;
  }
}

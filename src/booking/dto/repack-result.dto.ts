import { ApiProperty } from '@nestjs/swagger';

export class RepackResultDto {
  @ApiProperty({ description: 'Number of bookings that were reassigned to a tighter table', example: 2 })
  moved!: number;

  static from(value: number): RepackResultDto {
    const dto = new RepackResultDto();
    dto.moved = value;
    return dto;
  }
}

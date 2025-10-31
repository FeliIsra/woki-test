import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveBookingDto {
  @ApiPropertyOptional({ description: 'Name of the person approving the booking', example: 'Front desk manager', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  approver?: string;
}

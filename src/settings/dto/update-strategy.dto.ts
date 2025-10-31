import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateStrategyDto {
  @ApiProperty({
    example: 'conservative',
    description: 'Strategy key to use (simple | conservative | maxofmins).'
  })
  @IsString()
  key!: string;
}

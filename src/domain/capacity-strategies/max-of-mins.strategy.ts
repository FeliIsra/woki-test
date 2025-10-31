import { Injectable } from '@nestjs/common';

import { CapacityStrategy, CapacityStrategyResult } from './capacity-strategy.interface';
import { Table } from '../models';

/**
 * Conservative lower bound—treat combo capacity as the largest individual minimum,
 * while still allowing the maximum to reach the aggregate ceiling.
 */
@Injectable()
export class MaxOfMinsStrategy implements CapacityStrategy {
  readonly name = 'maxofmins';

  calculate(tables: Table[]): CapacityStrategyResult {
    const minCapacities = tables.map((table) => table.minCapacity);
    const min = Math.max(...minCapacities);
    const max = tables.reduce((sum, table) => sum + table.maxCapacity, 0);
    return { min, max };
  }
}

import { Injectable } from '@nestjs/common';

import { CapacityStrategy, CapacityStrategyResult } from './capacity-strategy.interface';
import { Table } from '../models';

/**
 * Baseline strategy—simply aggregate the raw min/max capacities of each table in the combo.
 */
@Injectable()
export class SimpleSumStrategy implements CapacityStrategy {
  readonly name = 'simple';

  calculate(tables: Table[]): CapacityStrategyResult {
    const min = tables.reduce((sum, table) => sum + table.minCapacity, 0);
    const max = tables.reduce((sum, table) => sum + table.maxCapacity, 0);
    return { min, max };
  }
}

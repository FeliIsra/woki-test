import { ConservativeMergeStrategy, MaxOfMinsStrategy, SimpleSumStrategy } from '@/domain/capacity-strategies';
import { createTable } from '../utils/factories';

describe('Capacity Strategies', () => {
  const tables = [
    createTable({ id: 't1', minCapacity: 2, maxCapacity: 4 }),
    createTable({ id: 't2', minCapacity: 4, maxCapacity: 6 }),
    createTable({ id: 't3', minCapacity: 6, maxCapacity: 8 })
  ];

  it('SimpleSumStrategy sums min and max capacities exactly', () => {
    const strategy = new SimpleSumStrategy();
    const result = strategy.calculate(tables);
    expect(result).toEqual({ min: 12, max: 18 });
  });

  it('ConservativeMergeStrategy reduces combined max capacity by 10%', () => {
    const strategy = new ConservativeMergeStrategy();
    const result = strategy.calculate(tables);
    // (4 + 6 + 8) * 0.9 = 16.2 => floored to 16
    expect(result).toEqual({ min: 12, max: 16 });
  });

  it('MaxOfMinsStrategy picks the largest min capacity but keeps summed max', () => {
    const strategy = new MaxOfMinsStrategy();
    const result = strategy.calculate(tables);
    expect(result).toEqual({ min: 6, max: 18 });
  });
});


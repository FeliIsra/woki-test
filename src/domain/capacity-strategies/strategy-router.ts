import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CapacityStrategy } from './capacity-strategy.interface';
import { SimpleSumStrategy } from './simple-sum.strategy';
import { ConservativeMergeStrategy } from './conservative-merge.strategy';
import { MaxOfMinsStrategy } from './max-of-mins.strategy';
import { Table } from '@/domain/models';

const STRATEGY_KEY_SIMPLE = 'simple';
const STRATEGY_KEY_CONSERVATIVE = 'conservative';
const STRATEGY_KEY_MAX_OF_MINS = 'maxofmins';

export interface StrategyOption {
  key: string;
  label: string;
  description: string;
}

@Injectable()
export class CapacityStrategyRouter implements CapacityStrategy {
  private readonly strategies: Record<string, CapacityStrategy>;
  private readonly metadata: Record<string, StrategyOption>;
  private currentKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly simple: SimpleSumStrategy,
    private readonly conservative: ConservativeMergeStrategy,
    private readonly maxOfMins: MaxOfMinsStrategy
  ) {
    this.strategies = {
      [STRATEGY_KEY_SIMPLE]: simple,
      [STRATEGY_KEY_CONSERVATIVE]: conservative,
      [STRATEGY_KEY_MAX_OF_MINS]: maxOfMins
    };

    this.metadata = {
      [STRATEGY_KEY_SIMPLE]: {
        key: STRATEGY_KEY_SIMPLE,
        label: 'Simple Sum',
        description: 'Adds each table’s min/max seats and fits the party in the combined range.'
      },
      [STRATEGY_KEY_CONSERVATIVE]: {
        key: STRATEGY_KEY_CONSERVATIVE,
        label: 'Conservative Merge',
        description:
          'Uses full min capacity but trims 10% of the max capacity to keep some buffer.'
      },
      [STRATEGY_KEY_MAX_OF_MINS]: {
        key: STRATEGY_KEY_MAX_OF_MINS,
        label: 'Max of Minimums',
        description:
          'Takes the highest minimum seat count to avoid under-seating large parties.'
      }
    };

    this.currentKey = this.normalizeKey(
      this.configService.get<string>('app.capacityStrategy') ?? STRATEGY_KEY_SIMPLE
    );
  }

  get name(): string {
    return this.currentStrategy.name;
  }

  calculate(tables: Table[]): { min: number; max: number } {
    return this.currentStrategy.calculate(tables);
  }

  getCurrentKey(): string {
    return this.currentKey;
  }

  getCurrentOption(): StrategyOption {
    return this.metadata[this.currentKey];
  }

  getAvailableOptions(): StrategyOption[] {
    return Object.values(this.metadata);
  }

  setStrategy(key: string): StrategyOption {
    const normalized = this.normalizeKey(key);
    this.currentKey = normalized;
    return this.metadata[normalized];
  }

  private get currentStrategy(): CapacityStrategy {
    return this.strategies[this.currentKey];
  }

  private normalizeKey(key: string | undefined): string {
    if (!key) {
      return STRATEGY_KEY_SIMPLE;
    }
    const normalized = key.toLowerCase();
    if (this.strategies[normalized]) {
      return normalized;
    }
    return STRATEGY_KEY_SIMPLE;
  }
}

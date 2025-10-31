import { Table } from '../models';

/**
 * Output bundle for capacity estimations when combining tables.
 */
export interface CapacityStrategyResult {
  min: number;
  max: number;
}

/**
 * Strategies allow swapping different heuristics (B3 requirement) without touching the booking core.
 */
export interface CapacityStrategy {
  readonly name: string;
  calculate(tables: Table[]): CapacityStrategyResult;
}

// DI token so Nest can inject whichever concrete strategy the configuration leverages.
export const CAPACITY_STRATEGY_TOKEN = Symbol('CAPACITY_STRATEGY');

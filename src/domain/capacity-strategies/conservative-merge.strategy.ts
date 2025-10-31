import { Injectable } from "@nestjs/common";

import {
    CapacityStrategy,
    CapacityStrategyResult,
} from "./capacity-strategy.interface";
import { Table } from "../models";

@Injectable()
export class ConservativeMergeStrategy implements CapacityStrategy {
    readonly name = "conservative";

    calculate(tables: Table[]): CapacityStrategyResult {
        // Keep the minimum untouched so the combined set always meets the individual guarantees.
        const min = tables.reduce((sum, table) => sum + table.minCapacity, 0);
        // Trim combined maximum by 10% to reflect real-world inefficiencies when tables are pushed together
        // (dead corners, aisle clearance, etc.).
        const max = Math.floor(
            tables.reduce((sum, table) => sum + table.maxCapacity, 0) * 0.9
        );
        return { min, max };
    }
}

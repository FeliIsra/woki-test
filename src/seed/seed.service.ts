import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { InMemoryStore } from '@/store/in-memory.store';
import { Restaurant, Sector, Table } from '@/domain/models';

export interface SeedSummary {
  restaurants: number;
  sectors: number;
  tables: number;
}

/**
 * Populates the in-memory store with deterministic data so tests and manual runs have a baseline.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly store: InMemoryStore) {}

  onApplicationBootstrap(): void {
    this.seedIfEmpty();
  }

  seedIfEmpty(): SeedSummary | undefined {
    if (this.store.listRestaurants().length) {
      return undefined;
    }

    const summary = this.applySeed();
    this.logger.log('Seeded demo restaurant data');
    return summary;
  }

  resetAndSeed(): SeedSummary {
    this.store.clear();
    const summary = this.applySeed();
    this.logger.log('Reset in-memory store and applied demo seed');
    return summary;
  }

  private applySeed(): SeedSummary {
    const { restaurant, sector, tables } = this.buildDemoDataset();
    this.store.upsertRestaurant(restaurant);
    this.store.upsertSector(sector);
    tables.forEach((table) => this.store.upsertTable(table));

    return {
      restaurants: 1,
      sectors: 1,
      tables: tables.length
    };
  }

  private buildDemoDataset(): {
    restaurant: Restaurant;
    sector: Sector;
    tables: Table[];
  } {
    const now = new Date();

    const restaurant: Restaurant = {
      id: 'resto-1',
      name: 'WokiBrain Bistro',
      timezone: 'UTC',
      serviceWindows: {
        0: [{ startTime: '10:00', endTime: '22:00' }],
        1: [{ startTime: '11:00', endTime: '22:00' }],
        2: [{ startTime: '11:00', endTime: '22:00' }],
        3: [{ startTime: '11:00', endTime: '22:00' }],
        4: [{ startTime: '11:00', endTime: '23:00' }],
        5: [{ startTime: '10:00', endTime: '23:00' }],
        6: [{ startTime: '10:00', endTime: '23:00' }]
      },
      createdAt: now,
      updatedAt: now
    };

    const sector: Sector = {
      id: 'sector-main',
      restaurantId: restaurant.id,
      name: 'Main Dining',
      createdAt: now,
      updatedAt: now
    };

    const tables: Table[] = [
      {
        id: 'table-1',
        restaurantId: restaurant.id,
        sectorId: sector.id,
        label: 'T1',
        minCapacity: 2,
        maxCapacity: 2,
        combinableWith: ['table-2'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'table-2',
        restaurantId: restaurant.id,
        sectorId: sector.id,
        label: 'T2',
        minCapacity: 2,
        maxCapacity: 4,
        combinableWith: ['table-1', 'table-3'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'table-3',
        restaurantId: restaurant.id,
        sectorId: sector.id,
        label: 'T3',
        minCapacity: 4,
        maxCapacity: 6,
        combinableWith: ['table-2'],
        createdAt: now,
        updatedAt: now
      }
    ];

    return { restaurant, sector, tables };
  }
}

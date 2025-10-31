import { InMemoryStore } from '@/store/in-memory.store';
import {
  Restaurant,
  Sector,
  Table
} from '@/domain/models';

export interface StoreSeed {
  restaurant: Restaurant;
  sector: Sector;
  tables: Table[];
}

export const createStoreWithDefaults = (): {
  store: InMemoryStore;
  seed: StoreSeed;
} => {
  const store = new InMemoryStore();
  const now = new Date();

  const restaurant: Restaurant = {
    id: 'resto-1',
    name: 'Test Restaurant',
    timezone: 'UTC',
    serviceWindows: {
      0: [{ startTime: '10:00', endTime: '22:00' }],
      1: [{ startTime: '10:00', endTime: '22:00' }],
      2: [{ startTime: '10:00', endTime: '22:00' }],
      3: [{ startTime: '10:00', endTime: '22:00' }],
      4: [{ startTime: '10:00', endTime: '22:00' }],
      5: [{ startTime: '10:00', endTime: '23:00' }],
      6: [{ startTime: '10:00', endTime: '23:00' }]
    },
    createdAt: now,
    updatedAt: now
  };

  const sector: Sector = {
    id: 'sector-1',
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

  store.upsertRestaurant(restaurant);
  store.upsertSector(sector);
  tables.forEach((table) => store.upsertTable(table));

  return { store, seed: { restaurant, sector, tables } };
};

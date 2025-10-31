import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger
} from '@nestjs/common';

import { SeedService } from '@/seed/seed.service';
import { IdempotencyService } from '@/store/idempotency.service';
import { LockingService } from '@/store/locking.service';
import { CapacityStrategyRouter, StrategyOption } from '@/domain/capacity-strategies';
import { InMemoryStore } from '@/store/in-memory.store';
import { Restaurant, Sector, Table } from '@/domain/models';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { CreateTableDto } from './dto/create-table.dto';

interface ResetResult {
  message: string;
  seededRestaurants: number;
  seededSectors: number;
  seededTables: number;
  timestamp: Date;
}

interface StrategySummary {
  current: StrategyOption;
  available: StrategyOption[];
}

interface CatalogSummary {
  restaurants: Restaurant[];
  sectors: Sector[];
  tables: Table[];
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly seedService: SeedService,
    private readonly idempotencyService: IdempotencyService,
    private readonly lockingService: LockingService,
    private readonly strategyRouter: CapacityStrategyRouter,
    private readonly store: InMemoryStore
  ) {}

  resetMemory(): ResetResult {
    this.idempotencyService.clear();
    this.lockingService.clear();

    const summary = this.seedService.resetAndSeed();
    const result: ResetResult = {
      message: 'In-memory caches cleared and demo dataset restored.',
      seededRestaurants: summary.restaurants,
      seededSectors: summary.sectors,
      seededTables: summary.tables,
      timestamp: new Date()
    };

    this.logger.log(result.message);
    return result;
  }

  getStrategySummary(): StrategySummary {
    return {
      current: this.strategyRouter.getCurrentOption(),
      available: this.strategyRouter.getAvailableOptions()
    };
  }

  updateStrategy(key: string): StrategySummary {
    const updated = this.strategyRouter.setStrategy(key);
    this.logger.log(`Switched capacity strategy to ${updated.label} (${updated.key})`);
    return this.getStrategySummary();
  }

  getCatalog(): CatalogSummary {
    return {
      restaurants: this.store.listRestaurants(),
      sectors: this.store.listSectors(),
      tables: this.store.listTables()
    };
  }

  createRestaurant(dto: CreateRestaurantDto): CatalogSummary {
    const restaurantId = dto.id.trim();
    const restaurantName = dto.name.trim();
    const timezone = (dto.timezone ?? 'UTC').trim();

    if (!restaurantId || !restaurantName) {
      throw new BadRequestException('Restaurant id and name are required.');
    }

    if (this.store.getRestaurant(restaurantId)) {
      throw new ConflictException(`Restaurant ${restaurantId} already exists.`);
    }

    const now = new Date();
    const serviceWindows = this.buildServiceWindows(dto.serviceWindows, dto.defaultWindow);

    const restaurant: Restaurant = {
      id: restaurantId,
      name: restaurantName,
      timezone,
      serviceWindows,
      createdAt: now,
      updatedAt: now
    };

    this.store.upsertRestaurant(restaurant);

    const sectorsInput = dto.sectors?.length
      ? dto.sectors
      : [{ id: `${restaurantId}-sector-main`, name: 'Main Dining' }];

    const seenSectorIds = new Set<string>();
    const sectors = sectorsInput.map((sector) => {
      const sectorId = sector.id.trim();
      const sectorName = sector.name.trim();
      if (!sectorId || !sectorName) {
        throw new BadRequestException('Sector id and name are required.');
      }
      const normalizedId = sectorId.toLowerCase();
      if (seenSectorIds.has(normalizedId)) {
        throw new BadRequestException('Sector ids must be unique.');
      }
      seenSectorIds.add(normalizedId);
      return {
        id: sectorId,
        name: sectorName,
        restaurantId: restaurant.id,
        createdAt: now,
        updatedAt: now
      } satisfies Sector;
    });

    for (const sector of sectors) {
      if (this.store.getSector(sector.id)) {
        throw new ConflictException(`Sector ${sector.id} already exists.`);
      }
      this.store.upsertSector(sector);
    }

    this.logger.log(`Created restaurant ${restaurant.name} (${restaurant.id})`);
    return this.getCatalog();
  }

  createTable(dto: CreateTableDto): CatalogSummary {
    const restaurant = this.store.getRestaurant(dto.restaurantId);
    if (!restaurant) {
      throw new BadRequestException(`Unknown restaurant ${dto.restaurantId}.`);
    }

    const sector = this.store.getSector(dto.sectorId);
    if (!sector || sector.restaurantId !== restaurant.id) {
      throw new BadRequestException(`Sector ${dto.sectorId} does not belong to ${dto.restaurantId}.`);
    }

    if (this.store.getTable(dto.id)) {
      throw new ConflictException(`Table ${dto.id} already exists.`);
    }

    if (dto.minCapacity > dto.maxCapacity) {
      throw new BadRequestException('minCapacity must be less than or equal to maxCapacity.');
    }

    const now = new Date();
    const peers: Table[] = [];
    if (dto.combinableWith?.length) {
      for (const peerId of dto.combinableWith) {
        const peer = this.store.getTable(peerId);
        if (!peer) {
          throw new BadRequestException(`Combinable table ${peerId} does not exist.`);
        }
        if (peer.restaurantId !== restaurant.id || peer.sectorId !== sector.id) {
          throw new BadRequestException(
            `Table ${peerId} belongs to a different restaurant or sector.`
          );
        }
        peers.push(peer);
      }
    }

    const table: Table = {
      id: dto.id,
      label: dto.label,
      restaurantId: restaurant.id,
      sectorId: sector.id,
      minCapacity: dto.minCapacity,
      maxCapacity: dto.maxCapacity,
      combinableWith: dto.combinableWith ?? [],
      createdAt: now,
      updatedAt: now
    };

    this.store.upsertTable(table);

    for (const peer of peers) {
      const updatedPeer: Table = {
        ...peer,
        combinableWith: Array.from(new Set([...peer.combinableWith, table.id])),
        updatedAt: now
      };
      this.store.upsertTable(updatedPeer);
    }

    this.logger.log(`Added table ${table.label} (${table.id}) to ${sector.name}`);
    return this.getCatalog();
  }

  private buildServiceWindows(
    schedules?: Array<{
      day: number;
      windows: Array<{ startTime: string; endTime: string }>;
    }>,
    defaultWindow?: { startTime: string; endTime: string }
  ): Restaurant['serviceWindows'] {
    const days = [0, 1, 2, 3, 4, 5, 6] as const;
    const defaultSchedule: Restaurant['serviceWindows'] = defaultWindow
      ? days.reduce((acc, day) => {
          acc[day] = [{ startTime: defaultWindow.startTime, endTime: defaultWindow.endTime }];
          return acc;
        }, {} as Restaurant['serviceWindows'])
      : {
          0: [{ startTime: '10:00', endTime: '22:00' }],
          1: [{ startTime: '11:00', endTime: '22:00' }],
          2: [{ startTime: '11:00', endTime: '22:00' }],
          3: [{ startTime: '11:00', endTime: '22:00' }],
          4: [{ startTime: '11:00', endTime: '23:00' }],
          5: [{ startTime: '10:00', endTime: '23:00' }],
          6: [{ startTime: '10:00', endTime: '23:00' }]
        };

    if (!schedules?.length) {
      return defaultSchedule;
    }

    const normalized: Restaurant['serviceWindows'] = { ...defaultSchedule };

    for (const schedule of schedules) {
      if (!Array.isArray(schedule.windows) || !schedule.windows.length) {
        normalized[schedule.day] = [];
        continue;
      }

      normalized[schedule.day] = schedule.windows.map((window) => ({
        startTime: window.startTime,
        endTime: window.endTime
      }));
    }

    return normalized;
  }
}

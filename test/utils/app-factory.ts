import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '@/app.module';
import { InMemoryStore } from '@/store/in-memory.store';
import { SeedService } from '@/seed/seed.service';

export interface TestAppContext {
  app: INestApplication;
  store: InMemoryStore;
  seed: SeedService;
}

export const createTestingApp = async (): Promise<TestAppContext> => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  const store = app.get(InMemoryStore);
  const seed = app.get(SeedService);
  return { app, store, seed };
};

export const resetSeedData = (_store: InMemoryStore, seed: SeedService): void => {
  seed.resetAndSeed();
};

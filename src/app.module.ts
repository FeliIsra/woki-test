import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import configuration from './config/configuration';
import { BookingModule } from './booking/booking.module';
import { MetricsModule } from './metrics/metrics.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { SeedModule } from './seed/seed.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration]
    }),
    ScheduleModule.forRoot(),
    BookingModule,
    WaitlistModule,
    MetricsModule,
    SeedModule,
    SettingsModule
  ]
})
export class AppModule {}

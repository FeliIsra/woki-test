import { Module, forwardRef } from '@nestjs/common';

import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { BookingModule } from '@/booking/booking.module';
import { SeedModule } from '@/seed/seed.module';

@Module({
  imports: [forwardRef(() => BookingModule), SeedModule],
  controllers: [SettingsController],
  providers: [SettingsService]
})
export class SettingsModule {}

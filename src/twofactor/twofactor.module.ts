import { Module } from '@nestjs/common';
import { TwoFactorService } from './twofactor.service';

@Module({
  providers: [TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}

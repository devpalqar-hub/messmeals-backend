import { Module } from '@nestjs/common';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [PrismaModule, S3Module],
  controllers: [BrandingController],
  providers: [BrandingService],
  exports: [BrandingService],
})
export class BrandingModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GeocodingModule } from 'src/geocoding/geocoding.module';
import { OpenMessController } from './open-mess.controller';
import { OpenMessService } from './open-mess.service';
import { WebsitesModule } from 'src/websites/websites.module';

@Module({
  imports: [PrismaModule, GeocodingModule, WebsitesModule],
  controllers: [OpenMessController],
  providers: [OpenMessService],
})
export class OpenModule {}

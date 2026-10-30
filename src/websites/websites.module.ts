import { Module } from '@nestjs/common';
import { WebsitesController } from './websites.controller';
import { WebsitesService } from './websites.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WebsitesController],
  providers: [WebsitesService],
  exports: [WebsitesService],
})
export class WebsitesModule {}

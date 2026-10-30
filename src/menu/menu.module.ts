import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { V1MenuController } from './v1-menu.controller';
import { V1MenuService } from './v1-menu.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MenuController, V1MenuController],
  providers: [MenuService, V1MenuService],
  exports: [MenuService, V1MenuService],
})
export class MenuModule {}

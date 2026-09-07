import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GeocodingModule } from 'src/geocoding/geocoding.module';
import { OpenMessController } from './open-mess.controller';
import { OpenMessService } from './open-mess.service';

@Module({
    imports: [PrismaModule, GeocodingModule],
    controllers: [OpenMessController],
    providers: [OpenMessService],
})
export class OpenModule { }

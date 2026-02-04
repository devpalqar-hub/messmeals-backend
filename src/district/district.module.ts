import { Module } from '@nestjs/common';
import { DistrictService } from './district.service';
import { DistrictController } from './district.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [DistrictController],
    providers: [DistrictService, PrismaService],
    exports: [DistrictService],
})
export class DistrictModule { }

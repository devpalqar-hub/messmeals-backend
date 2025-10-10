import { Module } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { DeliveriesController } from './deliveries.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
    controllers: [DeliveriesController],
    providers: [DeliveriesService, PrismaService],
})
export class DeliveriesModule { }

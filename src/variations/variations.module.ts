import { Module } from '@nestjs/common';
import { VariationService } from './variations.service';
import { VariationController } from './variations.contollers';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
    controllers: [VariationController],
    providers: [VariationService, PrismaService],
})
export class VariationModule { }

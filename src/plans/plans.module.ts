import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Module } from 'src/s3/s3.module';

@Module({
    imports: [S3Module],
    controllers: [PlansController],
    providers: [PlansService, PrismaService],
})
export class PlansModule { }

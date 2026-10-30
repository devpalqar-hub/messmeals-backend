import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { V1PlansService } from './v1-plans.service';
import { V1PlansController } from './v1-plans.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [S3Module],
  controllers: [PlansController, V1PlansController],
  providers: [PlansService, V1PlansService, PrismaService],
  exports: [PlansService, V1PlansService],
})
export class PlansModule {}

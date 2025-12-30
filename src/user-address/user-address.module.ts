import { Module } from '@nestjs/common';
import { AddressController } from './user-address.controller';
import { AddressService } from './user-address.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PlansService } from 'src/plans/plans.service';

@Module({
    controllers: [AddressController],
    providers: [PlansService, PrismaService, AddressService],
    exports: [AddressService]
})
export class AddressModule { }

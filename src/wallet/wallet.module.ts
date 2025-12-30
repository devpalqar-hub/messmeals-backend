import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PrismaService } from '../prisma/prisma.service'; // make sure you have a PrismaService

@Module({
    controllers: [WalletController],
    providers: [WalletService, PrismaService],
    exports: [WalletService],
})
export class WalletModule { }

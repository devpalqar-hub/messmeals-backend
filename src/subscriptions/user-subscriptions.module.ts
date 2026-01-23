import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserSubscriptionsService } from './user-subscriptions.service';
import { UserSubscriptionsController } from './user-subscriptions.controller';

@Module({
    providers: [PrismaService, UserSubscriptionsService],
    exports: [UserSubscriptionsService],
    controllers: [UserSubscriptionsController]
})
export class UserSubscriptionsModule { }

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CustomerModule } from './customers/customers.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { DeliveryAgentModule } from './deliveryagents/deliveryagents.module';
import { PlansModule } from './plans/plans.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [AuthModule, CustomerModule, DeliveriesModule, DeliveryAgentModule, PlansModule, PrismaModule, UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

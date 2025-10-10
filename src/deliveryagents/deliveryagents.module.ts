import { Module } from '@nestjs/common';
import { DeliveryAgentService } from './deliveryagents.service';
import { DeliveryAgentController } from './deliveryagents.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';


@Module({
    imports: [
        UserModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'super-secret-key',
            signOptions: { expiresIn: '7d' },
        }),
    ],
    providers: [DeliveryAgentService, PrismaService],
    controllers: [DeliveryAgentController],
    exports: [DeliveryAgentService],
})
export class DeliveryAgentModule { }

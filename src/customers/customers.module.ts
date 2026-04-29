import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerService } from './customers.service';
import { CustomerController } from './customers.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModule } from 'src/user/user.module';
import { PaymentsModule } from 'src/payments/payments.module';

@Module({
    imports: [
        UserModule,
        PaymentsModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'super-secret-key',
            signOptions: { expiresIn: '7d' },
        }),
    ],
    providers: [CustomerService, PrismaService],
    controllers: [CustomerController],
    exports: [CustomerService],
})
export class CustomerModule { }

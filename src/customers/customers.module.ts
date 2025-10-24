import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerService } from './customers.service';
import { CustomerController } from './customers.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModule } from 'src/user/user.module';

@Module({
    imports: [
        UserModule,
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
    
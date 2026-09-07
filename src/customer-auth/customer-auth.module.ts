import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TwoFactorModule } from 'src/twofactor/twofactor.module';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';

@Module({
    imports: [
        PrismaModule,
        TwoFactorModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'super-secret-key',
            signOptions: { expiresIn: '365d' },
        }),
    ],
    controllers: [CustomerAuthController],
    providers: [CustomerAuthService],
})
export class CustomerAuthModule { }

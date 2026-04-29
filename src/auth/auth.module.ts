import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModule } from 'src/user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from 'src/common/strategies/jwt.strategy';
import { ConfigModule } from '@nestjs/config';
import { TwoFactorModule } from 'src/twofactor/twofactor.module';
import { TwoFactorService } from 'src/twofactor/twofactor.service';

@Module({
    imports: [
        UserModule,
        ConfigModule,
        TwoFactorModule,
        PassportModule.register({ defaultStrategy: 'jwt' }), // 👈 register jwt
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'super-secret-key',
            signOptions: { expiresIn: '6m' },
        }),
    ],
    providers: [AuthService, PrismaService, JwtStrategy, TwoFactorService],
    controllers: [AuthController],
    exports: [AuthService],
})
export class AuthModule { }

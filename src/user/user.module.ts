import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from './user.service';
import { AddressModule } from 'src/user-address/user-address.module';
import { AddressService } from 'src/user-address/user-address.service';

@Module({
    imports: [AddressModule],
    providers: [UserService, PrismaService, AddressService],
    exports: [UserService],
})
export class UserModule { }

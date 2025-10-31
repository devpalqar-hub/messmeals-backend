import { Module } from '@nestjs/common';
import { MessAdminController } from './mess-admin.controller';
import { MessAdminService } from './mess-admin.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [MessAdminController],
    providers: [MessAdminService],
    exports: [MessAdminService],
})
export class MessAdminModule { }

import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OpenMessController } from './open-mess.controller';
import { OpenMessService } from './open-mess.service';

@Module({
    imports: [PrismaModule],
    controllers: [OpenMessController],
    providers: [OpenMessService],
})
export class OpenModule { }

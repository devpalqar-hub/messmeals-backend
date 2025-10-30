import { Module } from '@nestjs/common';
import { ContactFormService } from './contact-form.service';
import { ContactFormController } from './contact-form.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
    imports: [PrismaModule, MailerModule],
    controllers: [ContactFormController],
    providers: [ContactFormService],
})
export class ContactFormModule { }

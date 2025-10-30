// src/company/job-openings/job-opening-form.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContactFormDto } from './dto/contact-form.dto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class ContactFormService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailerService,
    ) { }

    async submitForm(dto: CreateContactFormDto) {
        const { Name, phone_number, email, message } = dto;

        // Send email to admin
        await this.mailService.sendMail({
            to: process.env.MAIL_USER,
            subject: `New Enquiry from ${Name}`,
            template: 'welcome', // looks for src/templates/welcome.pug
            context: {
                Name,
                phone_number,
                email,
                message,
                // job_title: job ? job.title : 'Unknown Position',
            },
        });

        return { message: 'Form submitted successfully.' };
    }
}

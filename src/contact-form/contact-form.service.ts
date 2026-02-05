// src/company/job-openings/job-opening-form.service.ts

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContactFormDto } from './dto/contact-form.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { paginate } from 'src/common/utility/pagination.util';
import { Role } from '@prisma/client';

@Injectable()
export class ContactFormService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailerService,
    ) { }

    async submitForm(dto: CreateContactFormDto) {
        const { Name, phone_number, email, message, messname, district, pincode } = dto;

        // 🔹 Create enquiry (MESS_OWNER)
        await this.prisma.enquiry.create({
            data: {
                name: Name,
                email,
                phone: phone_number,
                message,
                messname,
                district,
                pincode,
                enquiryType: 'MESS_OWNER',
            },
        });


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
    async submitMessEnquiry(dto: {
        name: string;
        email: string;
        phone?: string;
        message: string;
        messId: string;
        planId: string;
    }) {
        const { name, email, phone, message, messId, planId } = dto;

        // 🔹 Fetch mess with admins and user emails
        const mess = await this.prisma.mess.findUnique({
            where: { id: messId },
            include: {
                messAdmins: {
                    include: {
                        user: {
                            select: { email: true, name: true },
                        },
                    },
                },
            },
        });

        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        // 🔹 Create enquiry (USER)
        await this.prisma.enquiry.create({
            data: {
                name,
                email,
                phone,
                message,
                enquiryType: 'USER',
                messId,
                planId
            },
        });

        // 🔹 Collect recipient emails
        const recipientEmails = new Set<string>();

        // 1️⃣ Mess email (if exists)
        if (mess.email) {
            recipientEmails.add(mess.email);
        }

        // 2️⃣ Mess admin user emails
        mess.messAdmins.forEach((admin) => {
            if (admin.user?.email) {
                recipientEmails.add(admin.user.email);
            }
        });

        // 🔹 Send email to all recipients
        if (recipientEmails.size) {
            await this.mailService.sendMail({
                to: Array.from(recipientEmails),
                subject: `New Enquiry for ${mess.name}`,
                template: 'welcome', // reuse existing template
                context: {
                    messName: mess.name,
                    name,
                    email,
                    phone,
                    message,
                },
            });
        }

        return { message: 'Enquiry sent successfully.' };
    }


    async findAllEnquiries(params: {
        user: { role: Role; messAdminProfile?: { messes: { id: string }[] } };
        page?: number;
        limit?: number;
        search?: string;
        messId?: string;
    }) {
        const { user, page, limit, search, messId } = params;

        let where: any = {};

        // 🔹 Search (common for both roles)
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
            ];
        }

        // 🔹 Role-based access
        if (user.role === 'MESSADMIN') {
            const adminMessIds =
                user.messAdminProfile?.messes.map((m) => m.id) ?? [];

            if (!adminMessIds.length) {
                return {
                    message: 'Enquiries fetched successfully',
                    data: [],
                    meta: {
                        total: 0,
                        page: page ?? 1,
                        limit: limit ?? 10,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPrevPage: false,
                    },
                };
            }

            where.messId = messId
                ? messId // 🔹 explicit filter
                : { in: adminMessIds }; // 🔹 all admin messes
        }

        // 🔹 SUPERADMIN → no mess restriction

        const result = await paginate({
            prismaModel: this.prisma.enquiry,
            page,
            limit,
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                mess: {
                    select: { id: true, name: true },
                },
            },
        });

        return {
            message: 'Enquiries fetched successfully',
            data: result.data,
            meta: result.meta,
        };
    }

    async deleteEnquiry(
        id: string,
        user: {
            role: Role;
            messAdminProfile?: { messes: { id: string }[] };
        },
    ) {
        const enquiry = await this.prisma.enquiry.findUnique({
            where: { id },
            select: { id: true, messId: true },
        });

        if (!enquiry) {
            throw new NotFoundException('Enquiry not found');
        }

        // 🔐 MESSADMIN access control
        if (user.role === 'MESSADMIN') {
            const adminMessIds =
                user.messAdminProfile?.messes.map((m) => m.id) ?? [];

            if (!enquiry.messId || !adminMessIds.includes(enquiry.messId)) {
                throw new ForbiddenException(
                    'You are not allowed to delete this enquiry',
                );
            }
        }

        // 🔐 SUPERADMIN → allowed for all

        await this.prisma.enquiry.delete({
            where: { id },
        });

        return {
            message: 'Enquiry deleted successfully',
        };
    }


}

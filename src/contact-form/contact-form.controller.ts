import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CreateContactFormDto } from './dto/contact-form.dto';
import { ContactFormService } from './contact-form.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnquiryType, Role } from '@prisma/client';

@Controller('contact-form')
export class ContactFormController {
    constructor(private readonly service: ContactFormService) { }

    @Post("admin")
    async submit(@Body() dto: CreateContactFormDto) {
        return this.service.submitForm(dto);
    }

    @Post('mess')
    submitMessEnquiry(
        @Body()
        dto: {
            name: string;
            email: string;
            phone?: string;
            message: string;
            messId: string;
            planId: string;
        },
    ) {
        return this.service.submitMessEnquiry(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @Get()
    findAll(
        @Req() req: any,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('search') search?: string,
        @Query('messId') messId?: string,
        @Query('enquiryType') enquiryType?: EnquiryType, // ✅ added
    ) {
        return this.service.findAllEnquiries({
            user: req.user,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search,
            messId,
            enquiryType, // ✅ pass forward
        });
    }

    @Delete(':id')
    delete(
        @Param('id') id: string,
        @Req() req: any,
    ) {
        return this.service.deleteEnquiry(id, req.user);
    }
}



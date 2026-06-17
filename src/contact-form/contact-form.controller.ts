import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CreateContactFormDto } from './dto/contact-form.dto';
import { ContactFormService } from './contact-form.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnquiryType, Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Contact Form')
@Controller('contact-form')
export class ContactFormController {
    constructor(private readonly service: ContactFormService) { }

    @Post("admin")
    @ApiOperation({ summary: 'Submit admin contact form', description: 'Stores a general contact enquiry from the admin form.' })
    @ApiResponse({ status: 201, description: 'Contact form submitted successfully.' })
    async submit(@Body() dto: CreateContactFormDto) {
        return this.service.submitForm(dto);
    }

    @Post('mess')
    @ApiOperation({ summary: 'Submit mess enquiry', description: 'Stores a mess-specific enquiry.' })
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
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List enquiries', description: 'Returns enquiries with role-based filtering and query params.' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'messId', required: false })
    @ApiQuery({ name: 'enquiryType', required: false })
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
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete enquiry', description: 'Deletes an enquiry by UUID.' })
    @ApiParam({ name: 'id', description: 'Enquiry UUID' })
    delete(
        @Param('id') id: string,
        @Req() req: any,
    ) {
        return this.service.deleteEnquiry(id, req.user);
    }
}



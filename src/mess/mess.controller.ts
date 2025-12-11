import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
    DefaultValuePipe,
    ParseIntPipe,
    BadRequestException,
    UseGuards,
    Req,
    NotFoundException,
} from '@nestjs/common';
import { MessService } from './mess.service';
import { CreateMessDto, UpdateMessDto } from './dto/create-mess.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('mess')
export class MessController {
    constructor(private readonly messService: MessService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN)
    @Post()
    create(@Body() dto: CreateMessDto) {
        return this.messService.create(dto);
    }

    @Get()
    findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
    ) {
        return this.messService.findAll(page, limit, search);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.messService.findOne(id);
    }

    @Patch(':id')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateMessDto,
    ) {
        return this.messService.update(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN)
    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.messService.remove(id);
    }

    @Get(':id/stats')
    getStats(@Param('id', ParseUUIDPipe) id: string) {
        return this.messService.getMessStats(id);
    }




}

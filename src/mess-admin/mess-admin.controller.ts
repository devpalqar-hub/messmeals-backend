import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
    DefaultValuePipe,
    ParseIntPipe,
    UseGuards,
} from '@nestjs/common';
import { MessAdminService } from './mess-admin.service';
import { AssignMessAdminDto, RemoveMessAdminDto, CreateMessAdminDto } from './dto/mess-admin.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('mess-admin')
export class MessAdminController {
    constructor(private readonly messAdminService: MessAdminService) { }

    @Post()
    createMessAdmin(@Body() dto: CreateMessAdminDto) {
        return this.messAdminService.createMessAdmin(dto);
    }

    @Post('assign')
    assignMessAdmin(@Body() dto: AssignMessAdminDto) {
        return this.messAdminService.assignMessAdmin(dto);
    }

    @Delete('remove')
    removeMessAdmin(@Body() dto: RemoveMessAdminDto) {
        return this.messAdminService.removeMessAdminFromMess(dto);
    }

    @Get()
    findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
    ) {
        return this.messAdminService.findAll(page, limit, search);
    }

    @Get('by-mess/:messId')
    getMessAdminsByMess(
        @Param('messId', ParseUUIDPipe) messId: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.messAdminService.getMessAdminsByMess(messId, page, limit);
    }

    @Get(':userId')
    findOne(@Param('userId', ParseUUIDPipe) userId: string) {
        return this.messAdminService.findOne(userId);
    }
}

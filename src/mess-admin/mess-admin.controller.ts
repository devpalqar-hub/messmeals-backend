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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@ApiTags('Mess Admin')
@ApiBearerAuth()
@Controller('mess-admin')
export class MessAdminController {
    constructor(private readonly messAdminService: MessAdminService) { }

    // @ApiOperation({ summary: 'Create mess admin', description: 'Creates a new mess admin profile.' })
    // @Post()
    // createMessAdmin(@Body() dto: CreateMessAdminDto) {
    //     return this.messAdminService.createMessAdmin(dto);
    // }

    @ApiOperation({ summary: 'Assign mess admin', description: 'Assigns a mess admin to a mess.' })
    @Post('assign')
    assignMessAdmin(@Body() dto: AssignMessAdminDto) {
        return this.messAdminService.assignMessAdmin(dto);
    }

    @ApiOperation({ summary: 'Remove mess admin', description: 'Removes a mess admin from a mess.' })
    @Delete('remove')
    removeMessAdmin(@Body() dto: RemoveMessAdminDto) {
        return this.messAdminService.removeMessAdminFromMess(dto);
    }

    @ApiOperation({ summary: 'List mess admins', description: 'Returns paginated mess admins with search support.' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'search', required: false })
    @Get()
    findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
    ) {
        return this.messAdminService.findAll(page, limit, search);
    }

    @ApiOperation({ summary: 'List mess admins by mess', description: 'Returns mess admins assigned to a mess.' })
    @ApiParam({ name: 'messId', description: 'Mess UUID' })
    @Get('by-mess/:messId')
    getMessAdminsByMess(
        @Param('messId', ParseUUIDPipe) messId: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.messAdminService.getMessAdminsByMess(messId, page, limit);
    }

    @ApiOperation({ summary: 'Get mess admin by user id', description: 'Fetches a mess admin profile by user UUID.' })
    @ApiParam({ name: 'userId', description: 'User UUID' })
    @Get(':userId')
    findOne(@Param('userId', ParseUUIDPipe) userId: string) {
        return this.messAdminService.findOne(userId);
    }
}

import { Body, Controller, Post, Get, Query, Patch, Param, DefaultValuePipe, ParseIntPipe, Delete, UseGuards, Req, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserService } from './user.service';
import { GetUsersQueryDto } from './dto/list-users.query.dto';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';


@ApiTags('Users')
@Controller('users')
export class UserControllers {
    constructor(private readonly service: UserService) { }

    //SuperAdmin to get all users with pagination and filters
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles("SUPERADMIN")
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List users', description: 'Returns users for superadmin with filters.' })
    @Get("all")
    async getAllUsers(@Query() query: GetUsersQueryDto) {
        return this.service.getAllUsersForSuperAdmin(query);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles("SUPERADMIN")
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get user by id', description: 'Returns a user by UUID for superadmin.' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    @Get('all/:id')
    async getUserById(@Param('id') id: string) {
        return this.service.getUserByIdForSuperAdmin(id);
    }


    // GET /user/profile/:id
    @UseGuards(JwtAuthGuard)     // optional - apply only if protected endpoint
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get my profile', description: 'Returns the authenticated user profile.' })
    @Get('profile/')
    async getUserProfile(@Req() req) {
        return await this.service.userProfile(req.user.id);
    }



} 

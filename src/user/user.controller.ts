import { Body, Controller, Post, Get, Query, Patch, Param, DefaultValuePipe, ParseIntPipe, Delete, UseGuards, Req, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserService } from './user.service';


@Controller('users')
export class UserControllers {
    constructor(private readonly service: UserService) { }

    // GET /user/profile/:id
    @UseGuards(JwtAuthGuard)     // optional - apply only if protected endpoint
    @Get('profile/')
    async getUserProfile(@Req() req) {
        return await this.service.userProfile(req.user.id);
    }



} 

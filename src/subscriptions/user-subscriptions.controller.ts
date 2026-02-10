import { Body, Controller, Delete, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { UserSubscriptionsService } from './user-subscriptions.service';
import { UpdateDeliveryPriorityDto } from './dto/update-delivery-priority.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateUserSubscriptionDto } from './dto/update-user-subscription.dto';

@Controller('user-subscriptions')
export class UserSubscriptionsController {
    constructor(
        private readonly userSubscriptionsService: UserSubscriptionsService,
    ) { }


    @Patch(':id/delivery-priority')
    updateDeliveryPriority(
        @Param('id') id: string,
        @Body() dto: UpdateDeliveryPriorityDto,
    ) {
        return this.userSubscriptionsService.updateDeliveryPriority(id, dto);
    }


    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
    @Get()
    getAll(
        @Req() req: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('messId') messId?: string,
        @Query('isActive') isActive?: string,
    ) {
        return this.userSubscriptionsService.getAll(req.user, {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            messId,
            isActive:
                isActive !== undefined ? isActive === 'true' : undefined,
        });
    }

    /**
     * GET /user-subscriptions/:id
     */
    @Get(':id')
    getById(@Param('id') id: string) {
        return this.userSubscriptionsService.getById(id);
    }


    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN)
    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateUserSubscriptionDto,
    ) {
        return this.userSubscriptionsService.update(id, dto);
    }

    /**
     * Admin delete subscription (soft delete)
     */
    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.userSubscriptionsService.delete(id);
    }
}

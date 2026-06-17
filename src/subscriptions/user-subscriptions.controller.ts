import { Body, Controller, Delete, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { UserSubscriptionsService } from './user-subscriptions.service';
import { UpdateDeliveryPriorityDto } from './dto/update-delivery-priority.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateUserSubscriptionDto } from './dto/update-user-subscription.dto';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('User Subscriptions')
@Controller('user-subscriptions')
export class UserSubscriptionsController {
    constructor(
        private readonly userSubscriptionsService: UserSubscriptionsService,
    ) { }


    @Patch(':id/delivery-priority')
    @ApiOperation({ summary: 'Update delivery priority', description: 'Updates delivery priority for a subscription.' })
    @ApiParam({ name: 'id', description: 'Subscription UUID' })
    updateDeliveryPriority(
        @Param('id') id: string,
        @Body() dto: UpdateDeliveryPriorityDto,
    ) {
        return this.userSubscriptionsService.updateDeliveryPriority(id, dto);
    }


    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List subscriptions', description: 'Returns subscriptions with optional filters and role-based access.' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'messId', required: false })
    @ApiQuery({ name: 'isActive', required: false })
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
    @ApiOperation({ summary: 'Get subscription by id', description: 'Fetches a subscription by UUID.' })
    @ApiParam({ name: 'id', description: 'Subscription UUID' })
    @Get(':id')
    getById(@Param('id') id: string) {
        return this.userSubscriptionsService.getById(id);
    }


    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update subscription', description: 'Updates a subscription by UUID.' })
    @ApiParam({ name: 'id', description: 'Subscription UUID' })
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
    @ApiOperation({ summary: 'Delete subscription', description: 'Deletes a subscription by UUID.' })
    @ApiParam({ name: 'id', description: 'Subscription UUID' })
    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.userSubscriptionsService.delete(id);
    }
}

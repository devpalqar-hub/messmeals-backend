import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateBillingGlobalConfigDto, UpdateMessBillingConfigDto } from './dto/billing-config.dto';
import { UpsertBillingTierDto } from './dto/billing-tier.dto';
import { InvoiceMonthQueryDto, SettleInvoiceDto } from './dto/invoice.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
    constructor(private readonly billingService: BillingService) { }

    @Get('global-config')
    @Roles(Role.SUPERADMIN)
    @ApiOperation({ summary: 'Get global billing config (superadmin)' })
    getGlobalConfig() {
        return this.billingService.getOrCreateGlobalConfig();
    }

    @Patch('global-config')
    @Roles(Role.SUPERADMIN)
    @ApiOperation({ summary: 'Update global billing config (superadmin)' })
    updateGlobalConfig(@Body() dto: UpdateBillingGlobalConfigDto) {
        return this.billingService.updateGlobalConfig(dto);
    }

    @Get('tiers')
    @Roles(Role.SUPERADMIN)
    @ApiOperation({ summary: 'List billing tiers (superadmin)' })
    listTiers() {
        return this.billingService.listTiers();
    }

    @Post('tiers')
    @Roles(Role.SUPERADMIN)
    @ApiOperation({ summary: 'Create billing tier (superadmin)' })
    createTier(@Body() dto: UpsertBillingTierDto) {
        return this.billingService.upsertTier(undefined, dto);
    }

    @Patch('tiers/:id')
    @Roles(Role.SUPERADMIN)
    @ApiOperation({ summary: 'Update billing tier (superadmin)' })
    @ApiParam({ name: 'id', description: 'Tier id (UUID)' })
    updateTier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertBillingTierDto) {
        return this.billingService.upsertTier(id, dto);
    }

    @Patch('mess/:messId/config')
    @Roles(Role.SUPERADMIN)
    @ApiOperation({ summary: 'Update per-mess billing config (superadmin)' })
    @ApiParam({ name: 'messId', description: 'Mess id (UUID)' })
    updateMessConfig(
        @Param('messId', ParseUUIDPipe) messId: string,
        @Body() dto: UpdateMessBillingConfigDto,
    ) {
        return this.billingService.updateMessConfig(messId, dto);
    }

    @Get('mess/:messId/invoice')
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiOperation({ summary: 'Get or generate invoice for a mess (superadmin, messadmin)' })
    @ApiParam({ name: 'messId', description: 'Mess id (UUID)' })
    @ApiQuery({ name: 'month', required: false, description: 'Usage month (YYYY-MM)' })
    async getInvoice(
        @Req() req: any,
        @Param('messId', ParseUUIDPipe) messId: string,
        @Query() query: InvoiceMonthQueryDto,
    ) {
        await this.billingService.assertUserCanAccessMess(req.user, messId);
        return this.billingService.getOrGenerateInvoice(messId, query.month);
    }

    @Post('mess/:messId/settle')
    @Roles(Role.SUPERADMIN)
    @ApiOperation({ summary: 'Settle invoice (mark paid) (superadmin)' })
    @ApiParam({ name: 'messId', description: 'Mess id (UUID)' })
    async settle(
        @Param('messId', ParseUUIDPipe) messId: string,
        @Body() dto: SettleInvoiceDto,
    ) {
        return this.billingService.settleInvoice(messId, dto.month);
    }

    @Get('mess/:messId/status')
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiOperation({ summary: 'Enforce + get current billing status (superadmin, messadmin)' })
    @ApiParam({ name: 'messId', description: 'Mess id (UUID)' })
    async status(@Req() req: any, @Param('messId', ParseUUIDPipe) messId: string) {
        await this.billingService.assertUserCanAccessMess(req.user, messId);
        return this.billingService.enforceBillingStatus(messId);
    }
}

import { Controller, Get, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CustomerService } from './customers.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customer/wallet')
export class WalletController {
    constructor(private readonly customerService: CustomerService) { }

    // GET /customer/wallet/transactions
    @Get('transactions')
    @Roles(Role.USER, Role.MESSADMIN, Role.SUPERADMIN)
    async getTransactions(
        @Req() req,
        @Query('userId') userId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const requester = req.user;

        let targetUserId = userId as string | undefined;
        // If requester is a normal user, force their own user id
        if (requester.role === Role.USER) {
            targetUserId = requester.id;
        }

        // fallback to requester id if not provided
        const uid = (targetUserId || requester.id) as string | undefined;
        if (!uid) throw new BadRequestException('userId is required');

        return this.customerService.getWalletTransactionsForUser(uid, Number(page) || 1, Number(limit) || 20);
    }
}

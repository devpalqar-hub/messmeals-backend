import { Controller, Post, Body, UseGuards, Req, Get, Query } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CreateTopupDto } from './dto/create-topup.dto';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {

    constructor(private readonly walletService: WalletService) { }

    // ------------------------------
    //  GET WALLET
    // ------------------------------
    @Get()
    @ApiOperation({
        summary: 'Get current user wallet',
        description: 'Returns the wallet details of the authenticated user.',
    })
    @ApiResponse({
        status: 200,
        description: 'Wallet fetched successfully.',
        schema: {
            example: {
                id: "wallet-id",
                userId: "user-id",
                walletAmount: 5000,
                createdAt: "2025-01-01T10:00:00Z",
                updatedAt: "2025-01-02T10:00:00Z"
            }
        }
    })
    async getWallet(@Req() req: any) {
        const userId = req.user.id;
        return this.walletService.getWallet(userId);
    }

    // ------------------------------
    //  WALLET TOPUP
    // ------------------------------
    @Post('topup')
    @ApiOperation({
        summary: 'Top up wallet (credit)',
        description: 'Credits a specified amount to the user wallet.',
    })
    @ApiResponse({
        status: 201,
        description: 'Wallet credited successfully.',
        schema: {
            example: {
                id: "txn-id",
                amount: 2000,
                balanceAfter: 7000,
                meta: { source: "razorpay" },
                createdAt: "2025-01-02T10:00:00Z"
            }
        }
    })
    async topup(@Req() req: any, @Body() dto: CreateTopupDto) {
        const userId = req.user.id;
        return this.walletService.topup(userId, dto.amount, dto.meta, dto.source);
    }

    // ------------------------------
    //  LIST TRANSACTIONS
    // ------------------------------
    @Get('transactions')
    @ApiOperation({
        summary: 'List wallet transactions',
        description:
            'Returns paginated list of wallet transactions for the authenticated user.',
    })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    @ApiResponse({
        status: 200,
        description: 'Transactions fetched.',
        schema: {
            example: {
                page: 1,
                limit: 20,
                total: 2,
                data: [
                    {
                        id: "txn-1",
                        amount: 2000,
                        balanceAfter: 7000,
                        meta: { note: "wallet top-up" },
                        createdAt: "2025-01-02T10:00:00Z"
                    },
                    {
                        id: "txn-2",
                        amount: -500,
                        balanceAfter: 6500,
                        meta: { note: "order payment" },
                        createdAt: "2025-01-03T10:00:00Z"
                    }
                ]
            }
        }
    })
    async transactions(
        @Req() req: any,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        const userId = req.user.id;
        const p = Math.max(1, +page);
        const l = Math.min(100, +limit);
        const skip = (p - 1) * l;

        return this.walletService.listTransactions(userId, skip, l);
    }
}

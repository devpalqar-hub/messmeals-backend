import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
    constructor(private prisma: PrismaService) { }

    async getOrCreateWalletForUser(userId: string) {
        let wallet = await this.prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            wallet = await this.prisma.wallet.create({
                data: { userId, walletAmount: 0 }
            });
        }
        return wallet;
    }

    async getWallet(userId: string) {
        const wallet = await this.getOrCreateWalletForUser(userId);
        return wallet;
    }

    // Top up (credit)
    async topup(userId: string, amount: number, meta?: any, source?: string) {
        if (amount <= 0) throw new BadRequestException('Amount must be positive');

        return await this.prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            const actualWallet = wallet ?? await tx.wallet.create({ data: { userId, walletAmount: 0 } });

            const newBalance = Number(actualWallet.walletAmount) + amount;

            const updated = await tx.wallet.update({
                where: { id: actualWallet.id },
                data: { walletAmount: newBalance },
            });

            await tx.transaction.create({
                data: {
                    walletId: actualWallet.id,
                    amount: amount,
                    balanceAfter: newBalance,
                    meta: { ...meta, source },
                }
            });

            return updated;
        });
    }


    // List transactions (pagination)
    async listTransactions(userId: string, skip = 0, take = 20) {
        const wallet = await this.getOrCreateWalletForUser(userId);
        const txs = await this.prisma.transaction.findMany({
            where: { walletId: wallet.id },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        });
        return txs;
    }
}

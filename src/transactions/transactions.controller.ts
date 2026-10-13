import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { TransactionsService } from './transactions.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { BalanceQueryDto } from './dto/balance-query.dto';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Roles(Role.MESSADMIN, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Record a payment (CREDIT)',
    description:
      'Manually records a payment received from a customer (e.g. cash/UPI collected ' +
      'outside the app) as a CREDIT ledger entry, reducing the amount they owe this mess. ' +
      'MESSADMIN can only record payments for their own mess(es).',
  })
  @Post('payment')
  recordPayment(@Body() dto: RecordPaymentDto, @Req() req: any) {
    if (
      req.user.role === Role.MESSADMIN &&
      !req.user.messIds?.includes(dto.messId)
    ) {
      throw new BadRequestException('Mess not found for this admin');
    }
    return this.transactionsService.recordPayment({
      customerProfileId: dto.customerProfileId,
      messId: dto.messId,
      subscriptionId: dto.subscriptionId,
      amount: dto.amount,
      note: dto.note,
    });
  }

  @Roles(Role.USER, Role.MESSADMIN, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'List ledger transactions',
    description:
      'Lists DEBIT (charge) and CREDIT (payment) ledger entries, paginated and filterable. ' +
      'USER sees only their own entries, MESSADMIN only their own mess(es), SUPERADMIN everything.',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'customerProfileId', required: false })
  @ApiQuery({ name: 'messId', required: false })
  @ApiQuery({ name: 'subscriptionId', required: false })
  @ApiQuery({ name: 'type', required: false, description: 'DEBIT or CREDIT' })
  @ApiQuery({ name: 'reason', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @Get()
  findAll(@Query() query: ListTransactionsQueryDto, @Req() req: any) {
    return this.transactionsService.findAll(query, req.user);
  }

  @Roles(Role.USER, Role.MESSADMIN, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Outstanding balance summary',
    description:
      'Returns totalDebit, totalCredit, balanceDue (amount still owed) and advanceBalance ' +
      '(amount prepaid but not yet consumed) for a customer-mess pair, or mess-wide when ' +
      'customerProfileId is omitted (MESSADMIN/SUPERADMIN only).',
  })
  @ApiQuery({ name: 'customerProfileId', required: false })
  @ApiQuery({ name: 'messId', required: false })
  @Get('balance')
  getBalance(@Query() query: BalanceQueryDto, @Req() req: any) {
    return this.transactionsService.getBalance(query, req.user);
  }
}

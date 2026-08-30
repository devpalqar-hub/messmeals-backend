import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
    ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ExpenseStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { S3Service } from 'src/s3/s3.service';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { PayExpenseDto } from './dto/pay-expense.dto';
import { ExpenseAnalyticsQueryDto } from './dto/expense-analytics-query.dto';

const maxSize = 10 * 1024 * 1024; // 10MB per receipt

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.MESSADMIN)
@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
    constructor(
        private readonly expensesService: ExpensesService,
        private readonly s3Service: S3Service,
    ) { }

    @ApiOperation({
        summary: 'Create expense',
        description:
            'Records a new expense for a mess under a given expense category. Status (UNPAID/PARTIALLY_PAID/PAID) ' +
            'is calculated automatically from amount vs paidAmount — not set directly. ' +
            'Pass status=PENDING to log a placeholder entry (amount can be left out) and fill in the rest later via PATCH.',
    })
    @ApiResponse({ status: 201, description: 'Expense created successfully.' })
    @Post()
    create(@Req() req: any, @Body() dto: CreateExpenseDto) {
        return this.expensesService.create(req.user, dto);
    }

    @ApiOperation({
        summary: 'Upload expense receipt',
        description: 'Uploads a receipt/bill image to S3 and returns its public URL. Use the URL as `receiptUrl` in create/update expense.',
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary' } },
            required: ['file'],
        },
    })
    @ApiResponse({ status: 201, description: 'Receipt uploaded successfully.' })
    @Post('receipts/upload')
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: maxSize },
            fileFilter: (_req, file, cb) => {
                const isImage = typeof file?.mimetype === 'string' && file.mimetype.startsWith('image/');
                const isPdf = file?.mimetype === 'application/pdf';
                if (!isImage && !isPdf) {
                    return cb(new BadRequestException('Only image or PDF files are allowed') as any, false);
                }
                cb(null, true);
            },
        }),
    )
    async uploadReceipt(@UploadedFile() file: any) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        const url = await this.s3Service.uploadFile(file, 'expenses');
        return { message: 'Receipt uploaded successfully', url };
    }

    @ApiOperation({ summary: 'Expense analytics summary', description: 'Returns total expense amount and count for the given date range.' })
    @ApiQuery({ name: 'messId', required: true })
    @ApiQuery({ name: 'date1', required: true })
    @ApiQuery({ name: 'date2', required: false })
    @ApiQuery({ name: 'categoryId', required: false })
    @ApiQuery({ name: 'status', required: false, enum: ExpenseStatus })
    @Get('analytics/summary')
    analyticsSummary(@Req() req: any, @Query(new ValidationPipe({ transform: true })) query: ExpenseAnalyticsQueryDto) {
        return this.expensesService.analyticsSummary(req.user, query);
    }

    @ApiOperation({ summary: 'Expense analytics by category', description: 'Returns total expense amount and count grouped by expense category.' })
    @ApiQuery({ name: 'messId', required: true })
    @ApiQuery({ name: 'date1', required: true })
    @ApiQuery({ name: 'date2', required: false })
    @ApiQuery({ name: 'categoryId', required: false })
    @ApiQuery({ name: 'status', required: false, enum: ExpenseStatus })
    @Get('analytics/by-category')
    analyticsByCategory(@Req() req: any, @Query(new ValidationPipe({ transform: true })) query: ExpenseAnalyticsQueryDto) {
        return this.expensesService.analyticsByCategory(req.user, query);
    }

    @ApiOperation({ summary: 'Expense analytics graph', description: 'Returns a date-bucketed expense series for line charting.' })
    @ApiQuery({ name: 'messId', required: true })
    @ApiQuery({ name: 'date1', required: true })
    @ApiQuery({ name: 'date2', required: false })
    @ApiQuery({ name: 'categoryId', required: false })
    @ApiQuery({ name: 'status', required: false, enum: ExpenseStatus })
    @Get('analytics/graph')
    analyticsGraph(@Req() req: any, @Query(new ValidationPipe({ transform: true })) query: ExpenseAnalyticsQueryDto) {
        return this.expensesService.analyticsGraph(req.user, query);
    }

    @ApiOperation({
        summary: 'List expenses',
        description:
            'Returns expenses for a mess with optional category, search, date-range and status ' +
            '(PENDING/UNPAID/PARTIALLY_PAID/PAID) filters, plus pagination. Each expense includes `balanceDue` ' +
            '(amount - paidAmount) and `isFullyPaid`. The response also includes a `summary` block with totals per ' +
            'status for the same category/date-range/search filters (independent of the status filter), so a status ' +
            'tab UI can show stable counts.',
    })
    @ApiQuery({ name: 'messId', required: true, description: 'Mess UUID' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'search', required: false, description: 'Search by expense title' })
    @ApiQuery({ name: 'categoryId', required: false })
    @ApiQuery({ name: 'date1', required: false })
    @ApiQuery({ name: 'date2', required: false })
    @ApiQuery({ name: 'status', required: false, enum: ExpenseStatus, description: 'Filter the list by payment status' })
    @ApiResponse({ status: 200, description: 'Expenses fetched successfully.' })
    @Get()
    findAll(
        @Req() req: any,
        @Query('messId', ParseUUIDPipe) messId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('categoryId') categoryId?: string,
        @Query('date1') date1?: string,
        @Query('date2') date2?: string,
        @Query('status') status?: ExpenseStatus,
    ) {
        return this.expensesService.findAll(
            req.user,
            messId,
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
            search,
            categoryId,
            date1,
            date2,
            status,
        );
    }

    @ApiOperation({ summary: 'Get expense by id' })
    @ApiParam({ name: 'id', description: 'Expense UUID' })
    @ApiResponse({ status: 200, description: 'Expense fetched successfully.' })
    @Get(':id')
    findOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.expensesService.findOne(req.user, id);
    }

    @ApiOperation({
        summary: 'Update expense',
        description:
            'Updates expense fields, including amount/paidAmount. Status (PENDING/UNPAID/PARTIALLY_PAID/PAID) is ' +
            're-calculated automatically from the resulting amount vs paidAmount — it cannot be set directly here.',
    })
    @ApiParam({ name: 'id', description: 'Expense UUID' })
    @ApiResponse({ status: 200, description: 'Expense updated successfully.' })
    @Patch(':id')
    update(
        @Req() req: any,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateExpenseDto,
    ) {
        return this.expensesService.update(req.user, id, dto);
    }

    @ApiOperation({
        summary: 'Update expense payment',
        description:
            'Dedicated endpoint to record a payment against an expense: pass `paidAmount` as the cumulative total ' +
            'paid to date (and `amount` too if it was left out at creation, e.g. a PENDING placeholder). Status ' +
            '(UNPAID/PARTIALLY_PAID/PAID) is calculated automatically from amount vs paidAmount — safe to call ' +
            'repeatedly to record instalments.',
    })
    @ApiParam({ name: 'id', description: 'Expense UUID' })
    @ApiResponse({ status: 200, description: 'Expense payment updated successfully.' })
    @Patch(':id/payment')
    updatePayment(
        @Req() req: any,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: PayExpenseDto,
    ) {
        return this.expensesService.payExpense(req.user, id, dto);
    }

    @ApiOperation({ summary: 'Delete expense' })
    @ApiParam({ name: 'id', description: 'Expense UUID' })
    @ApiResponse({ status: 200, description: 'Expense deleted successfully.' })
    @Delete(':id')
    remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.expensesService.remove(req.user, id);
    }
}

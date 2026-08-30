import {
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
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ExpenseCategoriesService } from './expense-categories.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.MESSADMIN)
@ApiTags('Expense Categories')
@ApiBearerAuth()
@Controller('expense-categories')
export class ExpenseCategoriesController {
    constructor(private readonly expenseCategoriesService: ExpenseCategoriesService) { }

    @ApiOperation({
        summary: 'Create expense category',
        description: 'Creates a new expense category for a mess (e.g. Groceries, Rent, Staff Salary).',
    })
    @ApiResponse({ status: 201, description: 'Expense category created successfully.' })
    @Post()
    create(@Req() req: any, @Body() dto: CreateExpenseCategoryDto) {
        return this.expenseCategoriesService.create(req.user, dto);
    }

    @ApiOperation({
        summary: 'List expense categories',
        description: 'Returns expense categories for a mess with optional search and pagination.',
    })
    @ApiQuery({ name: 'messId', required: true, description: 'Mess UUID' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'isActive', required: false })
    @ApiResponse({ status: 200, description: 'Expense categories fetched successfully.' })
    @Get()
    findAll(
        @Req() req: any,
        @Query('messId', ParseUUIDPipe) messId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('isActive') isActive?: string,
    ) {
        return this.expenseCategoriesService.findAll(
            req.user,
            messId,
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
            search,
            isActive !== undefined ? isActive === 'true' : undefined,
        );
    }

    @ApiOperation({ summary: 'Get expense category by id' })
    @ApiParam({ name: 'id', description: 'Expense category UUID' })
    @ApiResponse({ status: 200, description: 'Expense category fetched successfully.' })
    @Get(':id')
    findOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.expenseCategoriesService.findOne(req.user, id);
    }

    @ApiOperation({ summary: 'Update expense category' })
    @ApiParam({ name: 'id', description: 'Expense category UUID' })
    @ApiResponse({ status: 200, description: 'Expense category updated successfully.' })
    @Patch(':id')
    update(
        @Req() req: any,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateExpenseCategoryDto,
    ) {
        return this.expenseCategoriesService.update(req.user, id, dto);
    }

    @ApiOperation({
        summary: 'Delete expense category',
        description: 'Deletes an expense category. Fails if any expenses reference it — deactivate it instead.',
    })
    @ApiParam({ name: 'id', description: 'Expense category UUID' })
    @ApiResponse({ status: 200, description: 'Expense category deleted successfully.' })
    @Delete(':id')
    remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.expenseCategoriesService.remove(req.user, id);
    }
}

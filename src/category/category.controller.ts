import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('SUPERADMIN')
@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) { }


    @ApiOperation({
        summary: 'Create category',
        description: 'Creates a new meal category.'
    })
    @ApiResponse({ status: 201, description: 'Category created successfully.' })
    @Post()
    create(@Body() dto: CreateCategoryDto) {
        return this.categoryService.create(dto);
    }


    @ApiOperation({
        summary: 'List categories',
        description: 'Returns categories with optional pagination parameters.'
    })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiResponse({ status: 200, description: 'Categories fetched successfully.' })
    @Get()
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.categoryService.findAll(
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
        );
    }


    @ApiOperation({
        summary: 'Get category by id',
        description: 'Fetches a single category using its UUID identifier.'
    })
    @ApiParam({ name: 'id', description: 'Category UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Category fetched successfully.' })
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.categoryService.findOne(id);
    }

    @ApiOperation({
        summary: 'Update category',
        description: 'Updates an existing category by UUID.'
    })
    @ApiParam({ name: 'id', description: 'Category UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Category updated successfully.' })
    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateCategoryDto,
    ) {
        return this.categoryService.update(id, dto);
    }

    @ApiOperation({
        summary: 'Delete category',
        description: 'Deletes a category by UUID.'
    })
    @ApiParam({ name: 'id', description: 'Category UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Category deleted successfully.' })
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.categoryService.remove(id);
    }
}

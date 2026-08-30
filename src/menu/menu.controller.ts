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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

const scheduleExample = {
    monday: [{ variationId: '1f2e3d4c-1111-2222-3333-444455556666', items: 'Rice, Dal, Sabzi, Roti' }],
    tuesday: [{ variationId: '1f2e3d4c-1111-2222-3333-444455556666', items: 'Idli, Sambar, Chutney' }],
};

@ApiTags('Menu')
@Controller('menus')
export class MenuController {
    constructor(private readonly menuService: MenuService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Create menu',
        description:
            'Creates a weekly menu for a mess: a name plus a per-weekday schedule (monday..sunday), each day an ' +
            'array of { variationId, items } entries — a day can have multiple entries (e.g. Breakfast + Lunch). ' +
            'At least one day must have entries. A menu can exist unlinked from any plan — link it to one or more ' +
            'plans of the same mess via menuIds on POST/PATCH /plans instead.',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                messId: { type: 'string', example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11' },
                name: { type: 'string', example: 'Weekly Menu' },
                ...Object.fromEntries(
                    Object.keys(scheduleExample).concat(['wednesday', 'thursday', 'friday', 'saturday', 'sunday']).map((day) => [
                        day,
                        {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    variationId: { type: 'string', example: '1f2e3d4c-1111-2222-3333-444455556666' },
                                    items: { type: 'string', example: 'Rice, Dal, Sabzi, Roti' },
                                },
                            },
                        },
                    ]),
                ),
                isActive: { type: 'boolean', example: true },
            },
            required: ['messId', 'name'],
            example: { messId: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11', name: 'Weekly Menu', ...scheduleExample },
        },
    })
    @ApiResponse({ status: 201, description: 'Menu created successfully.' })
    @Post()
    create(@Req() req: any, @Body() dto: CreateMenuDto) {
        return this.menuService.create(req.user, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'List menus',
        description: 'Returns menus for a mess with optional plan/search/active filters and pagination.',
    })
    @ApiQuery({ name: 'messId', required: true, description: 'Mess UUID' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'search', required: false, description: 'Search by menu name' })
    @ApiQuery({ name: 'planId', required: false, description: 'Only menus linked to this plan' })
    @ApiQuery({ name: 'isActive', required: false })
    @ApiResponse({ status: 200, description: 'Menus fetched successfully.' })
    @Get()
    findAll(
        @Req() req: any,
        @Query('messId', ParseUUIDPipe) messId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('planId') planId?: string,
        @Query('isActive') isActive?: string,
    ) {
        return this.menuService.findAll(
            req.user,
            messId,
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
            search,
            planId,
            isActive !== undefined ? isActive === 'true' : undefined,
        );
    }

    @ApiOperation({
        summary: 'Get menus for a plan',
        description: 'Public: returns the active menus linked to a given plan (for a plan/mess detail page).',
    })
    @ApiParam({ name: 'planId', description: 'Plan UUID' })
    @ApiResponse({ status: 200, description: 'Menus fetched successfully.' })
    @Get('by-plan/:planId')
    findByPlan(@Param('planId', ParseUUIDPipe) planId: string) {
        return this.menuService.findByPlan(planId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get menu by id' })
    @ApiParam({ name: 'id', description: 'Menu UUID' })
    @ApiResponse({ status: 200, description: 'Menu fetched successfully.' })
    @Get(':id')
    findOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.menuService.findOne(req.user, id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Update menu',
        description:
            'Updates a menu. Only the weekday properties actually present in the body are replaced (pass [] to ' +
            'clear a day) — any day left out keeps its existing entries. To change which plans it\'s linked to, ' +
            'use menuIds on PATCH /plans/:id instead.',
    })
    @ApiParam({ name: 'id', description: 'Menu UUID' })
    @ApiResponse({ status: 200, description: 'Menu updated successfully.' })
    @Patch(':id')
    update(
        @Req() req: any,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateMenuDto,
    ) {
        return this.menuService.update(req.user, id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete menu' })
    @ApiParam({ name: 'id', description: 'Menu UUID' })
    @ApiResponse({ status: 200, description: 'Menu deleted successfully.' })
    @Delete(':id')
    remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.menuService.remove(req.user, id);
    }
}

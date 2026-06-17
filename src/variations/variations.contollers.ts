import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VariationService } from './variations.service';
import { CreateVariationDto } from './dto/create-variations.dto';
import { UpdateVariationDto } from './dto/update-variation.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';


// @Roles('SUPERADMIN')
@ApiTags('Variations')
@ApiBearerAuth()
@Controller('variation')
export class VariationController {
    constructor(private readonly variationService: VariationService) { }

    // ➕ POST /variation
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({
        summary: 'Create a new variation',
        description: 'Creates a plan variation such as breakfast, lunch, or dinner.'
    })
    @ApiResponse({ status: 201, description: 'Variation created successfully.' })
    @Post()
    create(@Body() dto: CreateVariationDto) {
        return this.variationService.create(dto);
    }

    // 📜 GET /variation
    @ApiOperation({
        summary: 'List all variations',
        description: 'Returns the complete list of variations available in the system.'
    })
    @ApiResponse({ status: 200, description: 'Variations fetched successfully.' })
    @Get()
    findAll() {
        return this.variationService.findAll();
    }

    // 🔍 GET /variation/:id
    @ApiOperation({
        summary: 'Get variation by id',
        description: 'Fetches a single variation using its UUID identifier.'
    })
    @ApiParam({ name: 'id', description: 'Variation UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Variation fetched successfully.' })
    @Get(':id')
    findById(@Param('id') id: string) {
        return this.variationService.findById(id);
    }

    // ✏️ PATCH /variation/:id
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({
        summary: 'Update variation',
        description: 'Updates a variation using its UUID identifier.'
    })
    @ApiParam({ name: 'id', description: 'Variation UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Variation updated successfully.' })
    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateVariationDto) {
        return this.variationService.update(id, dto);
    }

    // 🗑️ DELETE /variation/:id
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({
        summary: 'Delete variation',
        description: 'Deletes a variation by UUID.'
    })
    @ApiParam({ name: 'id', description: 'Variation UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Variation deleted successfully.' })
    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.variationService.delete(id);
    }
}

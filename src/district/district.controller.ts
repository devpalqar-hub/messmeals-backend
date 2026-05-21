import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DistrictService } from './district.service';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictDto } from './dto/update-district.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Districts')
@Controller('districts')
export class DistrictController {
    constructor(private readonly districtService: DistrictService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles('SUPERADMIN')
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Create district',
        description: 'Creates a new district record.'
    })
    @ApiResponse({ status: 201, description: 'District created successfully.' })
    @Post()
    create(@Body() dto: CreateDistrictDto) {
        return this.districtService.create(dto);
    }

    @ApiOperation({
        summary: 'List districts',
        description: 'Returns all districts.'
    })
    @ApiResponse({ status: 200, description: 'Districts fetched successfully.' })
    @Get()
    @Public()
    findAll() {
        return this.districtService.findAll();
    }

    @ApiOperation({
        summary: 'Get district by id',
        description: 'Fetches a district using its UUID identifier.'
    })
    @ApiParam({ name: 'id', description: 'District UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'District fetched successfully.' })
    @Get(':id')
    @Public()
    findOne(@Param('id') id: string) {
        return this.districtService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles('SUPERADMIN')
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Update district',
        description: 'Updates an existing district by UUID.'
    })
    @ApiParam({ name: 'id', description: 'District UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'District updated successfully.' })
    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateDistrictDto,
    ) {
        return this.districtService.update(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles('SUPERADMIN')
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Delete district',
        description: 'Deletes a district by UUID.'
    })
    @ApiParam({ name: 'id', description: 'District UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'District deleted successfully.' })
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.districtService.remove(id);
    }
}

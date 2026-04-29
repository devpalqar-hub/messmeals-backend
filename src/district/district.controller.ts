import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { DistrictService } from './district.service';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictDto } from './dto/update-district.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('districts')
export class DistrictController {
    constructor(private readonly districtService: DistrictService) { }

    @Post()
    create(@Body() dto: CreateDistrictDto) {
        return this.districtService.create(dto);
    }

    @Get()
    findAll() {
        return this.districtService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.districtService.findOne(id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateDistrictDto,
    ) {
        return this.districtService.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.districtService.remove(id);
    }
}

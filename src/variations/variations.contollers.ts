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
import { VariationService } from './variations.service';
import { CreateVariationDto } from './dto/create-variations.dto';
import { UpdateVariationDto } from './dto/update-variation.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('variation')
export class VariationController {
    constructor(private readonly variationService: VariationService) { }

    // ➕ POST /variation
    @Post()
    create(@Body() dto: CreateVariationDto) {
        return this.variationService.create(dto);
    }

    // 📜 GET /variation
    @Get()
    findAll() {
        return this.variationService.findAll();
    }

    // 🔍 GET /variation/:id
    @Get(':id')
    findById(@Param('id') id: string) {
        return this.variationService.findById(id);
    }

    // ✏️ PATCH /variation/:id
    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateVariationDto) {
        return this.variationService.update(id, dto);
    }

    // 🗑️ DELETE /variation/:id
    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.variationService.delete(id);
    }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DeliveryAgentService } from './deliveryagents.service';
import { DeliveryAgentCreateDto, DeliveryAgentUpdateDto } from './dto/deliveryagents-create.dto';

@Controller('delivery-agent')
export class DeliveryAgentController {
    constructor(private readonly service: DeliveryAgentService) { }

    @Post()
    create(@Body() dto: DeliveryAgentCreateDto) {
        return this.service.create(dto);
    }

    @Get()
    async findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const pageNum = page ? parseInt(page, 10) : 1;
        const limitNum = limit ? parseInt(limit, 10) : 10;
        return this.service.findAll(pageNum, limitNum);
    }

    @Get(':id')
    getById(@Param('id') id: string) {
        return this.service.getById(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: DeliveryAgentUpdateDto) {
        return this.service.updateDeliveryAgent(id, dto);
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.service.delete(id);
    }
}

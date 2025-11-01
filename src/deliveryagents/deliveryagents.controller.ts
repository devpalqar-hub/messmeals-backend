import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
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
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
        @Query('messId') messId?: string,
    ) {
        return this.service.findAll(page, limit, search, messId);
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

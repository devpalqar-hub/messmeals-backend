import { Body, Controller, Post, Get, Query, Patch, Param } from '@nestjs/common';
import { CustomerService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/create-customer.dto';

@Controller('customer')
export class CustomerController {
    constructor(private readonly cusomerservice: CustomerService) { }

    @Post('register-user')
    async register(@Body() dto: CreateCustomerDto) {
        return this.cusomerservice.CreateUser(dto);
    }

    @Patch(':id')
    async updateCustomer(
        @Param('id') id: string,
        @Body() dto: UpdateCustomerDto,
    ) {
        return this.cusomerservice.updateCustomerProfile(id, dto);
    }

    @Get()
    findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
        return this.cusomerservice.findAll(Number(page) || 1, Number(limit) || 10);
    }

    //add get customer by id

}

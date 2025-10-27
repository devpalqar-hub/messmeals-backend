import { Body, Controller, Post, Get, Query, Patch, Param, DefaultValuePipe, ParseIntPipe, Delete } from '@nestjs/common';
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
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
    ) {
        return this.cusomerservice.findAll(page, limit, search);
    }

    // 🔍 GET /customers/:id
    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.cusomerservice.findOne(id);
    }

    // 🔹 Delete Customer
    @Delete(':id')
    async deleteCustomer(@Param('id') id: string) {
        return this.cusomerservice.deleteCustomer(id);
    }

}

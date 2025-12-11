import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { AddressService } from './user-address.service';
import { CreateUserAddressDto } from './dto/user-address.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
    ApiTags,
    ApiOperation,
    ApiBody,
    ApiResponse,
} from '@nestjs/swagger';

@ApiTags('User Address')
@Controller('address')
@UseGuards(JwtAuthGuard)
export class AddressController {
    constructor(private readonly addressService: AddressService) { }

    // CREATE NEW DELIVERY ADDRESS
    @Post()
    @ApiOperation({ summary: "Create a new delivery address" })
    @ApiBody({
        description: "Request body format for creating a delivery address",
        type: CreateUserAddressDto,
    })
    @ApiResponse({
        status: 201,
        description: "Delivery address created successfully",
        schema: {
            example: {
                success: true,
                message: 'Delivery address created successfully',
                data: {
                    id: "address_uuid",
                    name: "John Doe",
                    street: "221B Baker Street",
                    townOrcity: "London",
                    country: "United Kingdom",
                    postcode: "NW1 6XE",
                    landmark: "Near Museum",
                    latitudeLogitude: "51.5237,-0.1585",
                    phone: "+44-9876543210",
                    email: "john@example.com",
                    profileId: "user_uuid"
                }
            }
        }
    })
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async createAddress(
        @Body() dto: CreateUserAddressDto,
        @Req() req,
    ) {
        const user_id = req.user.id;

        const address = await this.addressService.createDeliAddrs(dto, user_id);

        return {
            success: true,
            message: 'Delivery address created successfully',
            data: address,
        };
    }

    // GET ALL ADDRESSES OF USER
    @Get()
    @ApiOperation({ summary: "Get all saved delivery addresses of authenticated user" })
    @ApiResponse({
        status: 200,
        description: "List of all addresses",
        schema: {
            example: {
                success: true,
                message: "Fetched all delivery addresses",
                data: [
                    {
                        id: "address_uuid",
                        name: "John Doe",
                        street: "221B Baker Street",
                        townOrcity: "London",
                        country: "United Kingdom",
                        postcode: "NW1 6XE",
                        landmark: "Near Museum",
                        latitudeLogitude: "51.5237,-0.1585",
                        phone: "+44-9876543210",
                        email: "john@example.com",
                        profileId: "user_uuid"
                    }
                ]
            }
        }
    })
    async getAllAddresses(@Req() req) {
        const user_id = req.user.id;

        const addresses = await this.addressService.getAllDeliAddrs(user_id);

        return {
            success: true,
            message: 'Fetched all delivery addresses',
            data: addresses,
        };
    }
}

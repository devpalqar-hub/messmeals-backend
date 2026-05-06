import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
    DefaultValuePipe,
    ParseIntPipe,
    BadRequestException,
    UseGuards,
    Req,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { MessService } from './mess.service';
import { CreateMessDto, UpdateMessDto } from './dto/create-mess.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FoodType, Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
const maxSize = 10 * 1024 * 1024; // 50MB per media

@ApiTags('Mess')
@ApiBearerAuth()
@Controller('mess')
export class MessController {
    constructor(private readonly messService: MessService) { }

    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.SUPERADMIN)
    @ApiOperation({ summary: 'Create mess', description: 'Creates a mess with optional gallery images.' })
    @ApiResponse({ status: 201, description: 'Mess created successfully.' })
    @Post()
    @UsePipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
        }),
    )
    async create(@Body() dto: CreateMessDto, @Body('images') images?: { url: string }[]) {
        const imagePayload = (images || []).map((img) => ({ url: img.url }));
        return this.messService.create(dto, imagePayload);
    }

    @Get()
    @ApiOperation({ summary: 'List messes', description: 'Returns messes with filters and pagination.' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'categoryId', required: false })
    @ApiQuery({ name: 'ratings', required: false })
    @ApiQuery({ name: 'is_active', required: false })
    @ApiQuery({ name: 'is_verified', required: false })
    @ApiQuery({ name: 'location', required: false })
    @ApiQuery({ name: 'variationId', required: false })
    @ApiQuery({ name: 'foodType', required: false })
    @ApiQuery({ name: 'districtName', required: false })
    @ApiQuery({ name: 'latitude', required: false })
    @ApiQuery({ name: 'longitude', required: false })
    @ApiQuery({ name: 'date1', required: false })
    @ApiQuery({ name: 'date2', required: false })
    @ApiQuery({ name: 'minPrice', required: false })
    @ApiQuery({ name: 'maxPrice', required: false })
    findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
        @Query('categoryId') categoryId?: string,
        @Query('ratings') ratings?: string,
        @Query('is_active') is_active?: string,
        @Query('is_verified') is_verified?: string,
        @Query('location') location?: string,
        @Query('variationId') variationId?: string,
        @Query('foodType') foodType?: FoodType,
        @Query('districtName') districtName?: string,
        @Query('latitude') latitude?: string,
        @Query('longitude') logitude?: string,
        @Query('date1') date1?: string,
        @Query('date2') date2?: string,
        @Query('minPrice') minPrice?: string,
        @Query('maxPrice') maxPrice?: string,
    ) {
        return this.messService.findAll(
            page,
            limit,
            search,
            categoryId,
            ratings !== undefined ? Number(ratings) : undefined,
            is_active !== undefined ? is_active === 'true' : undefined,
            is_verified !== undefined ? is_verified === 'true' : undefined,
            location,
            variationId,
            foodType,
            districtName,
            latitude,
            logitude,   // <-- IMPORTANT
            date1,
            date2,
            minPrice,
            maxPrice,
        );

    }



    @ApiOperation({ summary: 'Get mess by id', description: 'Fetches a mess by UUID.' })
    @ApiParam({ name: 'id', description: 'Mess UUID' })
    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.messService.findOne(id);
    }

    @ApiOperation({ summary: 'Update mess', description: 'Updates a mess by UUID.' })
    @ApiParam({ name: 'id', description: 'Mess UUID' })
    @Patch(':id')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateMessDto,
    ) {
        return this.messService.update(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN)
    @ApiOperation({ summary: 'Delete mess', description: 'Deletes a mess by UUID.' })
    @ApiParam({ name: 'id', description: 'Mess UUID' })
    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.messService.remove(id);
    }

    @ApiOperation({ summary: 'Get mess stats', description: 'Returns stats for a mess by UUID.' })
    @ApiParam({ name: 'id', description: 'Mess UUID' })
    @Get(':id/stats')
    getStats(@Param('id', ParseUUIDPipe) id: string) {
        return this.messService.getMessStats(id);
    }



    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.MESS_ADMIN)
    @ApiOperation({ summary: 'Add mess images', description: 'Adds gallery image URLs to a mess.' })
    @ApiParam({ name: 'messId', description: 'Mess UUID' })
    @Post(':messId/gallery/images')
    async addMessImages(
        @Param('messId') messId: string,
        @Body('images') images: { url: string }[],
    ) {
        if (!images || images.length === 0) {
            throw new BadRequestException('At least one image is required');
        }
        const imagePayload = images.map((img) => ({ url: img.url }));
        return this.messService.addMessImages(messId, imagePayload);
    }

    // =========================
    // GET MESS IMAGES
    // =========================
    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.MESS_ADMIN)

    // @ApiOperation({ summary: 'Get mess gallery images' })
    // @ApiResponse({
    //     status: 200,
    //     description: 'Mess images fetched successfully',
    // })
    @ApiOperation({ summary: 'Get mess images', description: 'Returns all gallery images for a mess.' })
    @ApiParam({ name: 'messId', description: 'Mess UUID' })
    @Get(':messId/gallery/images')
    async getMessImages(@Param('messId') messId: string) {
        return this.messService.getMessImages(messId);
    }

    // =========================
    // DELETE MESS IMAGE
    // =========================
    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.MESS_ADMIN)
    @ApiOperation({ summary: 'Delete mess image', description: 'Deletes a single image from a mess gallery.' })
    @ApiParam({ name: 'messId', description: 'Mess UUID' })
    @ApiParam({ name: 'imageId', description: 'Image UUID' })
    @Delete(':messId/gallery/images/:imageId')
    async deleteMessGalleryImage(
        @Param('messId') messId: string,
        @Param('imageId') imageId: string,
    ) {
        return this.messService.deleteMessImage(messId, imageId);
    }


    //Only for development/testing:
    @ApiOperation({ summary: 'Fix coordinates', description: 'Development-only endpoint to populate missing coordinates.' })
    @Post('fix/coordinates')
    addMissingCoordinates() {
        return this.messService.addMissingCoordinates();
    }



    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiOperation({ summary: 'Add cover images', description: 'Adds cover image URL to a mess.' })
    @ApiParam({ name: 'messId', description: 'Mess UUID' })
    @Post(':messId/cover/image')
    async addCoverImages(
        @Param('messId') messId: string,
        @Body('images') images: { url: string }[],
        @Req() req: any,
    ) {
        if (!images || images.length === 0) {
            throw new BadRequestException('At least one image is required');
        }
        const imagePayload = images.map((img) => ({ url: img.url }));

        return this.messService.addCoverImages(
            messId,
            imagePayload,
            req.user.id,
            req.user.role,
        );
    }



}

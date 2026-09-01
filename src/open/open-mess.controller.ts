import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OpenMessService } from './open-mess.service';
import { ListOpenMessesDto } from './dto/list-open-messes.dto';

/// Public, unauthenticated API surface for the messmeals website — only ever returns
/// messes a superadmin has explicitly listed (Mess.isListed) via PATCH /mess/:id/listing.
@ApiTags('Open')
@Controller('open')
export class OpenMessController {
    constructor(private readonly openMessService: OpenMessService) { }

    @Get('messes')
    @ApiOperation({
        summary: 'List public messes',
        description:
            'Public mess listing for the website. Every filter is optional: search (name/description), ' +
            'foodType, planType (DAILY/MONTHLY), featured, isVerified, latitude/longitude. ' +
            'When featured=true and latitude/longitude are given, results are restricted to a 20km radius ' +
            'and returned in a shuffled (not always the same) order.',
    })
    @ApiResponse({ status: 200, description: 'Messes fetched successfully.' })
    findAll(@Query() query: ListOpenMessesDto) {
        return this.openMessService.findAll(query);
    }

    @Get('mess/:slug')
    @ApiOperation({
        summary: 'Get public mess detail by slug',
        description:
            'Full public detail for one mess: plans (with variations, images, and their linked menus), ' +
            'tags, food types, gallery, and cover image.',
    })
    @ApiParam({ name: 'slug', description: 'Mess slug' })
    @ApiResponse({ status: 200, description: 'Mess fetched successfully.' })
    findBySlug(@Param('slug') slug: string) {
        return this.openMessService.findBySlug(slug);
    }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OpenMessService } from './open-mess.service';
import { ListOpenMessesDto } from './dto/list-open-messes.dto';
import { SearchSuggestionsDto } from './dto/search-suggestions.dto';

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
            'When latitude/longitude are given (and featured is not), results are sorted by distance — ' +
            'shortest distance first, longest last — using each mess\'s stored coordinates. ' +
            'When featured=true and latitude/longitude are given, results are instead restricted to a ' +
            '20km radius and shuffled (not always the same order) rather than distance-sorted.',
    })
    @ApiResponse({ status: 200, description: 'Messes fetched successfully.' })
    findAll(@Query() query: ListOpenMessesDto) {
        return this.openMessService.findAll(query);
    }

    @Get('search-suggestions')
    @ApiOperation({
        summary: 'Search suggestions (mess names + locations)',
        description:
            'Combined autocomplete for the website search bar, returned as two groups. ' +
            '`messes` is matched straight from the database (id, slug, name) and never calls ' +
            'any external API. `locations` (name + latitude/longitude) comes from the Mapbox ' +
            'Geocoding API restricted to India, but only for queries of 3+ characters, and only when the normalized ' +
            'query is not already served from a 7-day in-memory cache — clients should still ' +
            'debounce keystrokes (~300ms) before calling this, to keep geocoding calls to a minimum.',
    })
    @ApiResponse({ status: 200, description: 'Suggestions fetched successfully.' })
    searchSuggestions(@Query() query: SearchSuggestionsDto) {
        return this.openMessService.searchSuggestions(query);
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

    @Get('popular-plans')
    @ApiOperation({
        summary: 'List popular plans',
        description:
            'Returns public plans from listed & active messes, paginated via page/limit. ' +
            'By default sorted by total customer subscriptions (most popular first). ' +
            'When latitude/longitude are given, sorted by distance instead — nearest mess ' +
            'first, farthest last — and each plan\'s `distanceKm` is populated.',
    })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'latitude', required: false, example: '9.9312' })
    @ApiQuery({ name: 'longitude', required: false, example: '76.2673' })
    @ApiResponse({ status: 200, description: 'Popular plans fetched successfully.' })
    findPopularPlans(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('latitude') latitude?: string,
        @Query('longitude') longitude?: string,
    ) {
        return this.openMessService.findPopularPlans(
            Number(page) || 1,
            Number(limit) || 10,
            latitude,
            longitude,
        );
    }
}

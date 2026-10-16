import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GeocodingService } from './geocoding.service';
import { SearchPlacesDto } from './dto/search-places.dto';

/// Standalone, unauthenticated place-autocomplete API (Mapbox-backed) — for any address/
/// location input field (e.g. mess-owner signup, user address form) that isn't the
/// website's combined mess+location search bar (that one is GET /open/search-suggestions).
@ApiTags('Geocoding')
@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get('search-places')
  @ApiOperation({
    summary: 'Search places (autocomplete)',
    description:
      'Place-name autocomplete backed by the Mapbox Geocoding API, restricted to India. ' +
      'Only queries of 3+ characters are sent to Mapbox (shorter queries return an empty ' +
      'list with no network call), and results are cached in-memory for 7 days per query. ' +
      'Clients should debounce keystrokes (~300ms) before calling this.',
  })
  @ApiResponse({ status: 200, description: 'Place suggestions fetched successfully.' })
  async searchPlaces(@Query() query: SearchPlacesDto) {
    const q = (query.q ?? '').trim();
    const limit = query.limit
      ? Math.max(1, Math.min(20, Number(query.limit) || 5))
      : 5;

    const data = q ? await this.geocodingService.suggestLocations(q, limit) : [];

    return { data };
  }
}

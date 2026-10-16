import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/// GET /geocoding/search-places — standalone place autocomplete (e.g. for an address/
/// location field on a signup or profile form), backed by Mapbox via GeocodingService.
export class SearchPlacesDto {
  @ApiPropertyOptional({
    example: 'Edu',
    description:
      'Place text to autocomplete. Only queries of 3+ characters are sent to Mapbox — ' +
      'shorter queries return an empty list without any network call.',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    example: '5',
    description: 'Max number of place suggestions to return, default 5.',
  })
  @IsOptional()
  @IsString()
  limit?: string;
}

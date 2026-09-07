import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/// GET /open/search-suggestions — combined mess-name + location autocomplete for the
/// website's search bar.
export class SearchSuggestionsDto {
    @ApiPropertyOptional({
        example: 'Super',
        description:
            'Search text. Mess suggestions match against it at any length; location ' +
            'suggestions only call the geocoding API once this is 3+ characters (shorter ' +
            'queries return an empty locations list without any network call).',
    })
    @IsOptional()
    @IsString()
    q?: string;

    @ApiPropertyOptional({
        example: '5',
        description: 'Max results per group (messes / locations), default 5.',
    })
    @IsOptional()
    @IsString()
    limit?: string;
}

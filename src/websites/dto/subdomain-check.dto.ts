import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CheckSubdomainDto {
  @ApiProperty({
    example: 'annapoorna',
    description: 'Requested subdomain slug (letters, numbers, hyphens)',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 63, { message: 'Subdomain must be between 2 and 63 characters' })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/, {
    message: 'Subdomain can only contain letters, numbers, and hyphens, and cannot start or end with a hyphen',
  })
  name!: string;
}


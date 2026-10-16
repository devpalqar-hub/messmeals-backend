import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class MessOwnerSignupDto {
  @ApiProperty({
    example: 'Suresh',
    description:
      'Contact / owner name (alias of ownerName if ownerName is omitted).',
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    example: 'Suresh Kumar',
    description: 'Owner name (optional; if omitted, `name` will be used).',
  })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiProperty({ example: '+919895728129' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Edappally, Kochi' })
  @IsString()
  address!: string;

  /**
   * Deprecated — no longer resolved against the Districts table or stored anywhere.
   * Declared only so older clients that still send it don't trip `forbidNonWhitelisted`;
   * the value is accepted and silently discarded.
   */
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Deprecated — accepted but ignored. Use latitude/longitude instead.',
  })
  @IsOptional()
  district?: unknown;

  /** Deprecated — same discard behavior as `district`. See its comment. */
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Deprecated — accepted but ignored. Use latitude/longitude instead.',
  })
  @IsOptional()
  zipcode?: unknown;

  /** Deprecated — same discard behavior as `district`. See its comment. */
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Deprecated — accepted but ignored. Use latitude/longitude instead.',
  })
  @IsOptional()
  postcode?: unknown;

  @ApiPropertyOptional({
    example: '9.9312',
    description: 'Latitude of the mess location.',
  })
  @IsOptional()
  @IsString()
  latitude?: string;

  @ApiPropertyOptional({
    example: '76.2673',
    description: 'Longitude of the mess location.',
  })
  @IsOptional()
  @IsString()
  longitude?: string;

  @ApiProperty({ example: 'Annapoorna Mess' })
  @IsString()
  messName!: string;

  @ApiProperty({ example: '123456', description: 'OTP received on phone.' })
  @IsString()
  otp!: string;
}

export class MessOwnerSendOtpDto {
  @ApiProperty({
    example: 'Suresh',
    description:
      'Contact / owner name (alias of ownerName if ownerName is omitted).',
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    example: 'Suresh Kumar',
    description: 'Owner name (optional; if omitted, `name` will be used).',
  })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiProperty({ example: '+919895728129' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Edappally, Kochi' })
  @IsString()
  address!: string;

  /**
   * Deprecated — no longer resolved against the Districts table or stored anywhere.
   * Declared only so older clients that still send it don't trip `forbidNonWhitelisted`;
   * the value is accepted and silently discarded.
   */
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Deprecated — accepted but ignored. Use latitude/longitude instead.',
  })
  @IsOptional()
  district?: unknown;

  /** Deprecated — same discard behavior as `district`. See its comment. */
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Deprecated — accepted but ignored. Use latitude/longitude instead.',
  })
  @IsOptional()
  zipcode?: unknown;

  /** Deprecated — same discard behavior as `district`. See its comment. */
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Deprecated — accepted but ignored. Use latitude/longitude instead.',
  })
  @IsOptional()
  postcode?: unknown;

  @ApiPropertyOptional({
    example: '9.9312',
    description: 'Latitude of the mess location.',
  })
  @IsOptional()
  @IsString()
  latitude?: string;

  @ApiPropertyOptional({
    example: '76.2673',
    description: 'Longitude of the mess location.',
  })
  @IsOptional()
  @IsString()
  longitude?: string;

  @ApiProperty({ example: 'Annapoorna Mess' })
  @IsString()
  messName!: string;
}

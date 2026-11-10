import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class AddCustomDomainDto {
  @ApiProperty({
    example: 'order.annapoornamess.in',
    description: 'Fully qualified custom domain name (without http:// or https://)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    {
      message: 'Please provide a valid domain name (e.g. order.myrestaurant.com)',
    },
  )
  domain!: string;
}


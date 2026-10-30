import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ClaimOfferDto {
  @ApiPropertyOptional({ example: 'b0a701fa-bfba-40a2-a89e-2fcda4b7a701', description: 'Business UUID (optional if user has only 1 business)' })
  @IsOptional()
  @IsUUID()
  messId?: string;
}

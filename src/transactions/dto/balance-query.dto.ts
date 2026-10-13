import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class BalanceQueryDto {
  @ApiPropertyOptional({
    description: 'Customer profile UUID (ignored for role USER — always their own)',
  })
  @IsOptional()
  @IsUUID()
  customerProfileId?: string;

  @ApiPropertyOptional({
    description:
      'Mess UUID. Required for MESSADMIN/SUPERADMIN when customerProfileId is given; ' +
      'omit it as a mess admin to get a per-mess total across all their customers.',
  })
  @IsOptional()
  @IsUUID()
  messId?: string;
}

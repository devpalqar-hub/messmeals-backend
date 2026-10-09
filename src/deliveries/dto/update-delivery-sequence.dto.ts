import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class UpdateSequenceItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  delivery_id: string;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  new_sequence: number;
}

export class UpdateDeliverySequenceDto {
  @ApiProperty({ type: [UpdateSequenceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSequenceItemDto)
  deliveries: UpdateSequenceItemDto[];
}

import { PartialType } from '@nestjs/mapped-types';
import { CreateVariationDto } from './create-variations.dto';

export class UpdateVariationDto extends PartialType(CreateVariationDto) { }

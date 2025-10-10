import { PartialType } from '@nestjs/mapped-types';
import { PlansDto } from './create-plan.dto';

export class UpdatePlanDto extends PartialType(PlansDto) { }

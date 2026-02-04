import { IsString } from 'class-validator';

export class CreateDistrictDto {
    @IsString()
    name: string;

    @IsString()
    image: string;
}

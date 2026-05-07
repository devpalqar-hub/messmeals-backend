import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class AssignDeliveryAgentDto {
    @ApiProperty({ example: 'd8eb8a6f-44b7-4eb8-b40c-1f9f3c2f6a44' })
    @IsUUID()
    agentId: string;

    @ApiProperty({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11' })
    @IsUUID()
    messId: string;
}

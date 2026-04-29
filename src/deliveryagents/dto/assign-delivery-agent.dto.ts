import { IsString, IsUUID } from 'class-validator';

export class AssignDeliveryAgentDto {
    @IsUUID()
    agentId: string;

    @IsUUID()
    messId: string;
}

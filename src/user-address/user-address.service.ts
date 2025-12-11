import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateUserAddressDto } from "./dto/user-address.dto";

@Injectable()
export class AddressService {
    constructor(private prisma: PrismaService) { }
    // User delivery Address Creation function
    async createDeliAddrs(dto: CreateUserAddressDto, user_id: string) {
        // 1️⃣ Find customer's profile id from the User table
        const profile = await this.prisma.customerProfile.findUnique({
            where: { userId: user_id }, // userId is unique in CustomerProfile
            select: { id: true },
        });

        if (!profile) {
            throw new BadRequestException("Customer profile not found for this user");
        }
        // 2️⃣ Create address using customerProfile.id
        return this.prisma.userAddress.create({
            data: {
                ...dto,
                profileId: profile.id,
            },
        });
    }

    async getAllDeliAddrs(user_id: string) {
        const profile = await this.prisma.customerProfile.findUnique({
            where: { userId: user_id },
            select: { id: true },
        });

        if (!profile) {
            throw new BadRequestException("Customer profile not found for this user");
        }

        return this.prisma.userAddress.findMany({
            where: { profileId: profile.id },
        });
    }
}
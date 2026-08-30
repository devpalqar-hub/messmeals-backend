import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Verifies that the requesting user is allowed to manage/view data for the given mess.
 * SUPERADMIN can access any mess. MESSADMIN can only access messes assigned to them.
 */
export async function assertMessAccess(
    prisma: PrismaService,
    user: { id: string; role: Role | string },
    messId: string,
) {
    if (user.role === Role.SUPERADMIN) return;

    if (user.role !== Role.MESSADMIN) {
        throw new ForbiddenException('You do not have access to this mess');
    }

    const access = await prisma.messAdminProfile.findFirst({
        where: {
            userId: user.id,
            messes: { some: { id: messId } },
        },
        select: { id: true },
    });

    if (!access) {
        throw new ForbiddenException('You do not have access to this mess');
    }
}

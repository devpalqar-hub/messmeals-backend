// src/common/utility/slug.util.ts
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

/// Lowercase, hyphenated, alnum-only slug base from a mess name (e.g. "Super Meals!" -> "super-meals").
export function slugify(text: string): string {
    const base = text
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return base || 'mess';
}

/// Generates a slug for a new mess, appending -2, -3, ... on collision so it stays unique.
/// Accepts either the PrismaService or a transaction client so it can run inside `$transaction`.
export async function generateUniqueMessSlug(
    client: PrismaService | Prisma.TransactionClient,
    name: string,
): Promise<string> {
    const base = slugify(name);
    let slug = base;
    let attempt = 2;

    while (await client.mess.findUnique({ where: { slug }, select: { id: true } })) {
        slug = `${base}-${attempt}`;
        attempt++;
    }

    return slug;
}

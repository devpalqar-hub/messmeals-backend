// src/common/utils/pagination.util.ts
import { Prisma } from '@prisma/client';

interface PaginationParams<T> {
  prismaModel: {
    findMany: (args?: any) => Promise<T[]>;
    count: (args?: any) => Promise<number>;
  };
  page?: number;
  limit?: number;
  where?: Prisma.Enumerable<any>;
  include?: Prisma.Enumerable<any>;
  orderBy?: Prisma.Enumerable<any>;
}

/**
 * Common pagination utility for Prisma models.
 */
export async function paginate<T>({
  prismaModel,
  page = 1,
  limit = 10,
  where,
  include,
  orderBy,
}: PaginationParams<T>) {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prismaModel.findMany({
      skip,
      take: limit,
      where,
      include,
      orderBy,
    }),
    prismaModel.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

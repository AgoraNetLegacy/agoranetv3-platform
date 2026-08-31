import type { PrismaClient } from "@prisma/client";

export const SOUL_DIRECTORY_PAGE_SIZE = 48;

export async function publicSoulDirectory(
  db: PrismaClient,
  input: { query?: string; page?: number; pageSize?: number } = {}
) {
  const query = input.query?.trim() ?? "";
  const pageSize = Math.min(Math.max(input.pageSize ?? SOUL_DIRECTORY_PAGE_SIZE, 1), 100);
  const requestedPage = Math.max(Math.floor(input.page ?? 1), 1);
  const where = {
    status: "active",
    // The platform directory is the roster of registered public profile windows,
    // not a presence indicator. Offline/Spirit state must never erase a True
    // Self or Alias from the directory.
    ...(query
      ? {
          OR: [
            { handle: { contains: query.replace(/^@/, "") } },
            { displayName: { contains: query } },
            { bio: { contains: query } },
            { bioPlace: { contains: query } },
          ],
        }
      : {}),
  };
  const total = await db.profile.count({ where });
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(requestedPage, pageCount);
  const profiles = await db.profile.findMany({
    where,
    select: {
      id: true,
      handle: true,
      displayName: true,
      bio: true,
      bioPlace: true,
      joinedPeriod: true,
    },
    orderBy: [{ displayName: "asc" }, { handle: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { profiles, total, page, pageCount, query };
}

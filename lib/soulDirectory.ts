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
    // Spirit Mode is the profile owner's explicit discovery veil. A profile
    // remains reachable by a known direct URL, but is not advertised here.
    spiritActive: false,
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
      face: true,
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

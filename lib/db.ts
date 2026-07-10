import { PrismaClient } from "@prisma/client";

// One client per process; hot-reload in dev would otherwise leak connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// The transaction-client type every ledger-writing helper accepts, so a
// gate clearance and its ledger event can commit atomically or not at all.
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export type DbOrTx = PrismaClient | Tx;

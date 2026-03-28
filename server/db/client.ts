import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | null = null;

export function getDbClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }

  return prismaClient;
}

export async function disconnectDbClient(): Promise<void> {
  if (!prismaClient) return;
  await prismaClient.$disconnect();
  prismaClient = null;
}

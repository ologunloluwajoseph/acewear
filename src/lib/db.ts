import { PrismaClient } from '@prisma/client'

// =====================================================================
// Deliverable 4 (Node.js edition): Secure Database Layer
// ---------------------------------------------------------------------
// The PHP platform used app/Core/Database.php — a PDO wrapper enforcing
// prepared statements. In the Node.js stack this role is played by the
// Prisma Client singleton below:
//   - Every query is fully parameterized by design (zero string SQL)
//   - Connection pooling handled internally via the global singleton
//   - Type-safe models => no column drift / injection surface
// Always import { db } from '@/lib/db' — never instantiate PrismaClient
// directly in routes.
// =====================================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

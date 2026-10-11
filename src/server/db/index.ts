import "server-only"

import { createDb, type Db } from "./client"

/**
 * Single shared connection pool. In dev, Next re-evaluates modules on every
 * edit, so the pool is kept on globalThis to avoid exhausting connections.
 */
const globalForDb = globalThis as unknown as { __king253Db?: Db }

export const db: Db =
  globalForDb.__king253Db ??
  createDb(
    process.env.DATABASE_URL ??
      (() => {
        throw new Error("DATABASE_URL is not set")
      })()
  )

if (process.env.NODE_ENV !== "production") globalForDb.__king253Db = db

export type { Db, Tx } from "./client"

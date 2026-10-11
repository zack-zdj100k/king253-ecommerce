import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { max: options.max ?? 10, prepare: true })
  return drizzle(client, { schema, casing: "snake_case" })
}

export type Db = ReturnType<typeof createDb>
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
/** Functions that work inside or outside a transaction accept either. */
export type DbOrTx = Db | Tx

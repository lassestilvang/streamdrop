import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

type SqlClient = ReturnType<typeof postgres>;
export type Database = PostgresJsDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __streamdrop_sql__: SqlClient | undefined;
  // eslint-disable-next-line no-var
  var __streamdrop_db__: Database | undefined;
}

export function getDatabase(): Database | null {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return null;
  }

  if (!globalThis.__streamdrop_sql__ || !globalThis.__streamdrop_db__) {
    const sql = postgres(databaseUrl, {
      prepare: false,
      max: 1,
    });

    globalThis.__streamdrop_sql__ = sql;
    globalThis.__streamdrop_db__ = drizzle(sql, { schema });
  }

  return globalThis.__streamdrop_db__;
}

export function getSqlClient(): SqlClient | null {
  getDatabase();
  return globalThis.__streamdrop_sql__ ?? null;
}

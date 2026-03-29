import { migrate } from "drizzle-orm/postgres-js/migrator";

import { getDatabase, getSqlClient } from "../db/client.js";
import { loadLocalEnv } from "./load-env.js";

loadLocalEnv();

const database = getDatabase();
const sql = getSqlClient();

if (!database || !sql) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

await migrate(database, { migrationsFolder: "drizzle" });
await sql.end({ timeout: 5 });

console.log("Drizzle migrations applied.");

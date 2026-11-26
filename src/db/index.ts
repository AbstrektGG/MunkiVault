import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __mvSql?: ReturnType<typeof postgres> };

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!globalForDb.__mvSql) globalForDb.__mvSql = postgres(url, { max: 10 });
  return globalForDb.__mvSql;
}

// Created lazily so that importing this module (for example during `next build`) never opens a connection.
let instance: ReturnType<typeof drizzle<typeof schema>> | undefined;
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_t, prop) {
    if (!instance) instance = drizzle(client(), { schema });
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };

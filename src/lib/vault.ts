import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import type { User } from "./auth";

// Every user has exactly one personal vault, created the first time they need it.
export async function ensurePersonalVault(user: Pick<User, "id" | "name">) {
  const find = () => db.select().from(organizations).where(eq(organizations.ownerId, user.id)).limit(1);
  const [existing] = await find();
  if (existing) return existing;
  await db.insert(organizations)
    .values({ name: `Personal vault (${user.name})`, kind: "personal", ownerId: user.id, description: "Private to you. Administrators cannot open it." })
    .onConflictDoNothing();
  const [created] = await find();
  return created;
}

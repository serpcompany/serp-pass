import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { createAuth, originFromHeaders } from "@/auth/server";
import { getDb } from "@/db/get-db";
import { humanRoleAssignments } from "@/db/schema";

export type HumanRole = "subscriber" | "publisher" | "operator";

type RequestHeaders = Pick<Headers, "get" | "forEach">;

export async function getHumanIdentityFromHeaders(requestHeaders: RequestHeaders) {
  const mutableHeaders = new Headers();
  requestHeaders.forEach((value, key) => mutableHeaders.append(key, value));
  const session = await createAuth(originFromHeaders(requestHeaders)).api.getSession({ headers: mutableHeaders });

  if (!session) {
    return null;
  }

  const assignments = await getDb()
    .select({ role: humanRoleAssignments.role })
    .from(humanRoleAssignments)
    .where(eq(humanRoleAssignments.userId, session.user.id));

  return {
    session,
    roles: assignments.map(({ role }) => role as HumanRole),
  };
}

export async function getHumanIdentity() {
  return getHumanIdentityFromHeaders(await headers());
}

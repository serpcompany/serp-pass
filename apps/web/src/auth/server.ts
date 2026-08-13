import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { getDb } from "@/db/get-db";
import * as schema from "@/db/schema";

type AuthEnvironment = CloudflareEnv & {
  BETTER_AUTH_SECRET?: string;
};

export function createAuth(origin: string) {
  const { env } = getCloudflareContext();
  const authEnvironment = env as AuthEnvironment;

  if (!authEnvironment.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is not configured for this environment");
  }

  return betterAuth({
    appName: "SERP Apps Pass",
    baseURL: origin,
    secret: authEnvironment.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            await getDb()
              .insert(schema.humanRoleAssignments)
              .values({
                userId: createdUser.id,
                role: "subscriber",
                source: "signup",
                grantedAt: new Date(),
              })
              .onConflictDoNothing();
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 10, max: 3 },
        "/sign-up/email": { window: 60, max: 20 },
      },
    },
    advanced: {
      useSecureCookies: origin.startsWith("https://"),
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    },
  });
}

export function originFromHeaders(requestHeaders: Pick<Headers, "get">) {
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) {
    throw new Error("Cannot derive the request origin without a host header");
  }

  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

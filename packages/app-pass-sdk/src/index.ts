import type { Entitlement } from "@serp-apps-pass/contracts";

export type { Entitlement } from "@serp-apps-pass/contracts";

export type AppPassStorage = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

export type AppPassClientOptions = {
  appId: string;
  runtimeId: string;
  authorityBaseUrl: string;
  apiPathPrefix?: string;
  storage?: AppPassStorage;
  fetch?: typeof globalThis.fetch;
};

export function appPassStorageKey(authorityBaseUrl: string, appId: string, item: "installation" | "pending" | "session") {
  return `app-pass:${new URL(authorityBaseUrl).origin}:${appId}:${item}`;
}

type PendingLink = { requestId: string; proofKey: string; activationUrl: string; expiresAt: string };

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function randomToken(byteLength = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function chromeStorage(): AppPassStorage {
  const storage = (globalThis as typeof globalThis & {
    chrome?: {
      storage?: {
        local?: {
          get(key: string): Promise<Record<string, unknown>>;
          set(values: Record<string, string>): Promise<void>;
          remove(key: string): Promise<void>;
        };
      };
    };
  }).chrome?.storage?.local;
  if (!storage) throw new Error("App Pass requires chrome.storage.local or an explicit storage adapter");
  return {
    async get(key) {
      const values = await storage.get(key);
      return typeof values[key] === "string" ? values[key] : undefined;
    },
    set: async (key, value) => void await storage.set({ [key]: value }),
    remove: async (key) => void await storage.remove(key),
  };
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string; message?: string };
  if (!response.ok) throw new Error(body.message ?? body.error ?? `App Pass request failed (${response.status})`);
  return body;
}

export function createAppPass(options: AppPassClientOptions) {
  const storage = options.storage ?? chromeStorage();
  const request = options.fetch ?? globalThis.fetch.bind(globalThis);
  const installationKey = appPassStorageKey(options.authorityBaseUrl, options.appId, "installation");
  const pendingKey = appPassStorageKey(options.authorityBaseUrl, options.appId, "pending");
  const sessionKey = appPassStorageKey(options.authorityBaseUrl, options.appId, "session");
  const apiPathPrefix = options.apiPathPrefix ?? "/api/app-pass";
  const endpoint = (pathname: string) => new URL(pathname, options.authorityBaseUrl).toString();

  async function installationId() {
    const existing = await storage.get(installationKey);
    if (existing) return existing;
    const created = `installation_${randomToken(18)}`;
    await storage.set(installationKey, created);
    return created;
  }

  return {
    async beginLink() {
      const proofKey = randomToken();
      const link = await responseJson<{ requestId: string; expiresAt: string; activationUrl: string }>(await request(
        endpoint(`${apiPathPrefix}/link-requests`),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            appId: options.appId,
            runtimeId: options.runtimeId,
            installationId: await installationId(),
            proofChallenge: await sha256(proofKey),
          }),
        },
      ));
      await storage.set(pendingKey, JSON.stringify({ ...link, proofKey } satisfies PendingLink));
      return link;
    },

    async linkState() {
      if (await storage.get(sessionKey)) return { status: "linked" as const };
      const rawPending = await storage.get(pendingKey);
      if (!rawPending) return { status: "unlinked" as const };
      try {
        const pending = JSON.parse(rawPending) as PendingLink;
        if (!pending.requestId || !pending.activationUrl || !pending.expiresAt) throw new Error("invalid");
        return { status: "pending" as const, requestId: pending.requestId, activationUrl: pending.activationUrl, expiresAt: pending.expiresAt };
      } catch {
        await storage.remove(pendingKey);
        return { status: "unlinked" as const };
      }
    },

    async clearPendingLink() {
      await storage.remove(pendingKey);
    },

    async resetLink() {
      await storage.remove(pendingKey);
      await storage.remove(sessionKey);
    },

    async finishLink() {
      const rawPending = await storage.get(pendingKey);
      if (!rawPending) throw new Error("No pending App Pass link");
      const pending = JSON.parse(rawPending) as PendingLink;
      const session = await responseJson<{ token: string }>(await request(
        endpoint(`${apiPathPrefix}/link-requests/${pending.requestId}/exchange`),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ proofKey: pending.proofKey }),
        },
      ));
      await storage.set(sessionKey, session.token);
      await storage.remove(pendingKey);
    },

    async check(): Promise<Entitlement> {
      const token = await storage.get(sessionKey);
      if (!token) return { status: "unauthenticated", reason: "not_linked" };
      try {
        const response = await request(endpoint(`${apiPathPrefix}/entitlements/check`), {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "x-app-id": options.appId,
            "x-runtime-id": options.runtimeId,
          },
        });
        if (response.status === 401) return { status: "unauthenticated", reason: "session_expired" };
        return await responseJson<Entitlement>(response);
      } catch {
        return { status: "temporarily_unavailable" };
      }
    },
  };
}

export type Entitlement =
  | { status: "active"; features: string[] }
  | { status: "inactive"; reason: "no_subscription" }
  | { status: "unauthenticated"; reason: "not_linked" | "session_expired" }
  | { status: "revoked"; reason: "session_revoked" | "app_suspended" }
  | { status: "temporarily_unavailable" };

export type AppPassStorage = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

export type AppPassClientOptions = {
  appId: string;
  runtimeId: string;
  authorityBaseUrl: string;
  storage?: AppPassStorage;
  fetch?: typeof globalThis.fetch;
};

type PendingLink = { requestId: string; proofKey: string };

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
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `App Pass request failed (${response.status})`);
  return body;
}

export function createAppPass(options: AppPassClientOptions) {
  const storage = options.storage ?? chromeStorage();
  const request = options.fetch ?? globalThis.fetch.bind(globalThis);
  const prefix = `app-pass:${options.appId}`;
  const installationKey = `${prefix}:installation`;
  const pendingKey = `${prefix}:pending`;
  const sessionKey = `${prefix}:session`;
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
      const link = await responseJson<{ requestId: string; expiresAt: string }>(await request(
        endpoint("/app-pass/link-requests"),
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
      await storage.set(pendingKey, JSON.stringify({ requestId: link.requestId, proofKey } satisfies PendingLink));
      return link;
    },

    async finishLink() {
      const rawPending = await storage.get(pendingKey);
      if (!rawPending) throw new Error("No pending App Pass link");
      const pending = JSON.parse(rawPending) as PendingLink;
      const session = await responseJson<{ token: string }>(await request(
        endpoint(`/app-pass/link-requests/${pending.requestId}/exchange`),
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
        const response = await request(endpoint("/app-pass/entitlements/check"), {
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

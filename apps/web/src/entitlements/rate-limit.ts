import { sha256Hex } from "./crypto";

export async function consumeAppLinkRateLimit(db: CloudflareEnv["DB"], request: Request, operation: "request" | "exchange") {
  const now = Math.floor(Date.now() / 1000);
  const windowSeconds = operation === "request" ? 600 : 60;
  const maximum = operation === "request" ? 20 : 60;
  const source = request.headers.get("cf-connecting-ip") ?? "local-or-unknown";
  const sourceHash = (await sha256Hex(source)).slice(0, 32);
  const key = `app-link:${operation}:${sourceHash}:${Math.floor(now / windowSeconds)}`;
  await db.prepare(`INSERT INTO rate_limit (id, key, count, last_request) VALUES (?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET count = rate_limit.count + 1, last_request = excluded.last_request`)
    .bind(key, key, now).run();
  const state = await db.prepare("SELECT count FROM rate_limit WHERE id = ?").bind(key).first<{ count: number }>();
  return { allowed: Boolean(state && state.count <= maximum), retryAfter: windowSeconds - (now % windowSeconds) };
}

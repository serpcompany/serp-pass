import assert from "node:assert/strict";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
const clientIp = `192.0.2.${40 + Math.floor(Math.random() * 100)}`;
const statuses: number[] = [];
let retryAfter: string | null = null;

for (let attempt = 0; attempt < 4; attempt += 1) {
  const response = await fetch(`${appOrigin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: appOrigin,
      ...(appOrigin.includes("localhost") ? { "cf-connecting-ip": clientIp } : {}),
    },
    body: JSON.stringify({ email: `missing-${Date.now()}@example.test`, password: "wrong-password" }),
  });
  statuses.push(response.status);
  if (response.status === 429) retryAfter = response.headers.get("x-retry-after");
}

assert.deepEqual(statuses, [401, 401, 401, 429]);
assert.ok(retryAfter, "Rate-limited response must tell the client when to retry");
process.stdout.write("PASS D1-backed sign-in rate limit\n");

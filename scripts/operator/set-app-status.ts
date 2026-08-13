const [appId, status, ...unexpected] = process.argv.slice(2);
if (!appId || (status !== "approved" && status !== "suspended") || unexpected.length > 0) {
  throw new Error("Usage: pnpm operator:set-app-status <app-id> <approved|suspended>");
}
const response = await fetch(`http://127.0.0.1:8787/operator/apps/${appId}/status`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ status }),
});
const body = await response.text();
if (!response.ok) throw new Error(body);
process.stdout.write(`${body}\n`);

export {};

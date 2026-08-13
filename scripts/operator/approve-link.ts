const [requestId, ...unexpected] = process.argv.slice(2);
if (!requestId || unexpected.length > 0) {
  throw new Error("Usage: pnpm operator:approve-link <request-id>");
}
const response = await fetch(`http://127.0.0.1:8787/operator/link-requests/${requestId}/approve`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ subscriberId: "subscriber_local" }),
});
const body = await response.text();
if (!response.ok) throw new Error(body);
process.stdout.write(`${body}\n`);

export {};

const [requestId, ...unexpected] = process.argv.slice(2);
if (!requestId || unexpected.length > 0) {
  throw new Error("Usage: pnpm operator:expire-link <request-id>");
}
const response = await fetch(`http://127.0.0.1:8787/operator/link-requests/${requestId}/expire`, {
  method: "POST",
});
const body = await response.text();
if (!response.ok) throw new Error(body);
process.stdout.write(`${body}\n`);

export {};

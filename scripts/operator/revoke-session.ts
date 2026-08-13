const [sessionId, ...unexpected] = process.argv.slice(2);
if (!sessionId || unexpected.length > 0) {
  throw new Error("Usage: pnpm operator:revoke-session <session-id>");
}
const response = await fetch(`http://127.0.0.1:8787/operator/sessions/${sessionId}/revoke`, {
  method: "POST",
});
const body = await response.text();
if (!response.ok) throw new Error(body);
process.stdout.write(`${body}\n`);

export {};

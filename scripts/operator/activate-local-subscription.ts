const response = await fetch("http://127.0.0.1:8787/operator/local-subscription", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    subscriberId: "subscriber_local",
    email: "subscriber@example.test",
    subscriptionId: "subscription_local",
  }),
});
const body = await response.text();
if (!response.ok) throw new Error(body);
process.stdout.write(`${body}\n`);

export {};

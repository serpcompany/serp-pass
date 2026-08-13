const response = await fetch("http://127.0.0.1:8787/operator/prototype-state");
const body = await response.text();
if (!response.ok) throw new Error(body);
process.stdout.write(`${body}\n`);

export {};

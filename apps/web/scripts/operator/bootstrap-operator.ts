import { execFileSync } from "node:child_process";

type Target = "local" | "staging";

const args = process.argv.slice(2).filter((argument) => argument !== "--");
const target: Target | undefined = args.includes("--local") ? "local" : args.includes("--staging") ? "staging" : undefined;
const email = args.find((argument) => !argument.startsWith("--"))?.trim().toLowerCase();

if (!target || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("Usage: pnpm mvp:operator:bootstrap -- --local|--staging operator@example.com");
}

const escapeSql = (value: string) => value.replaceAll("'", "''");
const auditId = crypto.randomUUID();
const escapedEmail = escapeSql(email);
const sql = [
  `INSERT INTO human_role_assignment (user_id, role, source, granted_at) SELECT id, 'operator', 'operator_bootstrap', unixepoch() FROM user WHERE lower(email) = '${escapedEmail}' ON CONFLICT(user_id, role) DO NOTHING`,
  `INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) SELECT '${auditId}', id, 'operator_bootstrapped', 'human_user', id, unixepoch(), 'trusted_cloudflare_cli' FROM user WHERE lower(email) = '${escapedEmail}'`,
].join("; ");

const wranglerArgs = target === "local"
  ? ["--filter", "@serp-apps-pass/web", "exec", "wrangler", "d1", "execute", "apps-pass-local", "--local", "--persist-to", "../../.wrangler/mvp-state", "--command", sql]
  : ["--filter", "@serp-apps-pass/web", "exec", "wrangler", "d1", "execute", "apps-pass-staging", "--env", "staging", "--remote", "--command", sql];

execFileSync("pnpm", wranglerArgs, { cwd: new URL("../../../..", import.meta.url), stdio: "inherit" });
process.stdout.write(`Operator role ensured for the requested account in ${target}.\n`);

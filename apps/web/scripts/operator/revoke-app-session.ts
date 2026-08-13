import { execFileSync } from "node:child_process";

import { escapeSql, parsedTarget, wranglerD1Args } from "./d1-target";

const { target, values } = parsedTarget(process.argv.slice(2));
const [sessionId, ...reasonParts] = values;
const reason = reasonParts.join(" ").trim();
if (!target || !sessionId || !/^appsession_[A-Za-z0-9_-]{24}$/.test(sessionId) || reason.length < 10 || reason.length > 1000) {
  throw new Error("Usage: pnpm mvp:operator:revoke-session -- --local|--staging appsession_<id> <reason of 10-1000 characters>");
}
const auditId = crypto.randomUUID();
const sql = [
  `INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) SELECT '${auditId}', NULL, 'app_session_revoked', 'app_session', id, unixepoch(), '${escapeSql(reason)}' FROM app_session WHERE id = '${escapeSql(sessionId)}' AND revoked_at IS NULL`,
  `UPDATE app_session SET revoked_at = unixepoch(), revoke_reason = '${escapeSql(reason)}' WHERE id = '${escapeSql(sessionId)}' AND revoked_at IS NULL`,
].join("; ");
execFileSync("pnpm", wranglerD1Args(target, sql), { cwd: new URL("../../../..", import.meta.url), stdio: "inherit" });
process.stdout.write(`App session revocation requested in ${target}; inspect state to confirm the exact target changed.\n`);

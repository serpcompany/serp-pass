import { execFileSync } from "node:child_process";

import { escapeSql, parsedTarget, wranglerD1Args } from "./d1-target";

const { target, values } = parsedTarget(process.argv.slice(2));
const [operatorEmail, sessionId, ...reasonParts] = values;
const reason = reasonParts.join(" ").trim();
if (!target || !operatorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operatorEmail) || !sessionId || !/^appsession_[A-Za-z0-9_-]{24}$/.test(sessionId) || reason.length < 10 || reason.length > 1000) {
  throw new Error("Usage: pnpm mvp:operator:revoke-session -- --local|--staging operator@example.com appsession_<id> <reason of 10-1000 characters>");
}
const auditId = crypto.randomUUID();
const actor = `SELECT role.user_id FROM human_role_assignment role JOIN user ON user.id = role.user_id WHERE role.role = 'operator' AND lower(user.email) = lower('${escapeSql(operatorEmail)}')`;
const sql = [
  `INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) SELECT '${auditId}', (${actor}), 'app_session_revoked', 'app_session', id, unixepoch(), '${escapeSql(reason)}' FROM app_session WHERE id = '${escapeSql(sessionId)}' AND revoked_at IS NULL AND (${actor}) IS NOT NULL`,
  `UPDATE app_session SET revoked_at = unixepoch(), revoke_reason = '${escapeSql(reason)}' WHERE id = '${escapeSql(sessionId)}' AND revoked_at IS NULL AND (${actor}) IS NOT NULL`,
].join("; ");
execFileSync("pnpm", wranglerD1Args(target, sql), { cwd: new URL("../../../..", import.meta.url), stdio: "inherit" });
process.stdout.write(`Authenticated Operator App-session revocation requested in ${target}; inspect state to confirm the exact target changed.\n`);

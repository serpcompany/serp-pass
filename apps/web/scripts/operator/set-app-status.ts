import { execFileSync } from "node:child_process";

import { escapeSql, parsedTarget, wranglerD1Args } from "./d1-target";

const { target, values } = parsedTarget(process.argv.slice(2));
const [operatorEmail, appId, status, ...reasonParts] = values;
const reason = reasonParts.join(" ").trim();
if (!target || !operatorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operatorEmail) || !appId || !/^app_[a-z0-9][a-z0-9_]{2,59}$/.test(appId) || (status !== "approved" && status !== "suspended") || reason.length < 10 || reason.length > 1000) {
  throw new Error("Usage: pnpm mvp:operator:set-app-status -- --local|--staging operator@example.com app_<id> approved|suspended <reason of 10-1000 characters>");
}
const auditId = crypto.randomUUID();
const action = status === "suspended" ? "app_suspended" : "app_reapproved";
const actor = `SELECT role.user_id FROM human_role_assignment role JOIN user ON user.id = role.user_id WHERE role.role = 'operator' AND lower(user.email) = lower('${escapeSql(operatorEmail)}')`;
const sql = [
  `INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) SELECT '${auditId}', (${actor}), '${action}', 'app', id, unixepoch(), '${escapeSql(reason)}' FROM app WHERE id = '${escapeSql(appId)}' AND status <> '${status}' AND (${actor}) IS NOT NULL`,
  `UPDATE app SET status = '${status}' WHERE id = '${escapeSql(appId)}' AND status <> '${status}' AND (${actor}) IS NOT NULL`,
].join("; ");
execFileSync("pnpm", wranglerD1Args(target, sql), { cwd: new URL("../../../..", import.meta.url), stdio: "inherit" });
process.stdout.write(`Authenticated Operator App status ${status} requested in ${target}; inspect state to confirm the exact target changed.\n`);

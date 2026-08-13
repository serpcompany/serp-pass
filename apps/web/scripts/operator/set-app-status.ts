import { execFileSync } from "node:child_process";

import { escapeSql, parsedTarget, wranglerD1Args } from "./d1-target";

const { target, values } = parsedTarget(process.argv.slice(2));
const [appId, status, ...reasonParts] = values;
const reason = reasonParts.join(" ").trim();
if (!target || !appId || !/^app_[a-z0-9][a-z0-9_]{2,59}$/.test(appId) || (status !== "approved" && status !== "suspended") || reason.length < 10 || reason.length > 1000) {
  throw new Error("Usage: pnpm mvp:operator:set-app-status -- --local|--staging app_<id> approved|suspended <reason of 10-1000 characters>");
}
const auditId = crypto.randomUUID();
const action = status === "suspended" ? "app_suspended" : "app_reapproved";
const sql = [
  `INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) SELECT '${auditId}', NULL, '${action}', 'app', id, unixepoch(), '${escapeSql(reason)}' FROM app WHERE id = '${escapeSql(appId)}' AND status <> '${status}'`,
  `UPDATE app SET status = '${status}' WHERE id = '${escapeSql(appId)}' AND status <> '${status}'`,
].join("; ");
execFileSync("pnpm", wranglerD1Args(target, sql), { cwd: new URL("../../../..", import.meta.url), stdio: "inherit" });
process.stdout.write(`App status ${status} requested in ${target}; inspect state to confirm the exact target changed.\n`);

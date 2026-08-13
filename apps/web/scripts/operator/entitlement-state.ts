import { execFileSync } from "node:child_process";

import { parsedTarget, wranglerD1Args } from "./d1-target";

const { target, values } = parsedTarget(process.argv.slice(2));
if (!target || values.length !== 0) throw new Error("Usage: pnpm mvp:operator:entitlement-state -- --local|--staging");
const sql = `SELECT session.id AS session_id, link.app_id, link.subscriber_user_id, link.installation_id,
  session.runtime_id, session.token_hash, session.created_at, session.revoked_at, session.revoke_reason
  FROM app_session session JOIN app_link link ON link.id = session.app_link_id ORDER BY session.created_at, session.id`;
execFileSync("pnpm", wranglerD1Args(target, sql), { cwd: new URL("../../../..", import.meta.url), stdio: "inherit" });

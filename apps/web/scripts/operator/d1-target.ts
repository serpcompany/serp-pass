export type OperatorTarget = "local" | "staging";

export function parsedTarget(args: string[]) {
  const target: OperatorTarget | undefined = args.includes("--local") ? "local" : args.includes("--staging") ? "staging" : undefined;
  return { target, values: args.filter((argument) => argument !== "--" && argument !== "--local" && argument !== "--staging") };
}

export function escapeSql(value: string) {
  return value.replaceAll("'", "''");
}

export function wranglerD1Args(target: OperatorTarget, command: string) {
  return target === "local"
    ? ["--filter", "@serp-apps-pass/web", "exec", "wrangler", "d1", "execute", "apps-pass-local", "--local", "--persist-to", "../../.wrangler/mvp-state", "--command", command]
    : ["--filter", "@serp-apps-pass/web", "exec", "wrangler", "d1", "execute", "apps-pass-staging", "--env", "staging", "--remote", "--command", command];
}

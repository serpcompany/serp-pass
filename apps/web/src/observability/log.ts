type LogLevel = "info" | "warn" | "error";

type StructuredEvent = {
  event: string;
  correlationId: string;
  environment: CloudflareEnv["APP_ENV"];
  outcome: string;
  [key: string]: string | number | boolean | null;
};

export function logEvent(level: LogLevel, event: StructuredEvent) {
  const write = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  write(event);
}

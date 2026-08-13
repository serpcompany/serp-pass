const CHROMIUM_RUNTIME_ID = /^[a-p]{32}$/;

export function runtimeIdFromExtensionOrigin(origin: string | null) {
  if (!origin?.startsWith("chrome-extension://")) return null;
  const runtimeId = origin.slice("chrome-extension://".length);
  return CHROMIUM_RUNTIME_ID.test(runtimeId) ? runtimeId : null;
}

export function extensionCorsHeaders(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-app-id, x-runtime-id",
    "access-control-max-age": "600",
    "cache-control": "no-store",
    vary: "Origin",
  };
}

export function extensionPreflight(request: Request) {
  const origin = request.headers.get("origin");
  return origin && runtimeIdFromExtensionOrigin(origin)
    ? new Response(null, { status: 204, headers: extensionCorsHeaders(origin) })
    : Response.json({ message: "Approved Chromium extension origin required." }, { status: 403 });
}

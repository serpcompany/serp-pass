import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { readSubscriberSubscription } from "@/billing/read";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  const { env } = getCloudflareContext();
  const subscription = await readSubscriberSubscription(identity.session.user.id, env.APP_ENV);
  if (!subscription) return Response.json({ subscription: null }, { headers: { "cache-control": "no-store" } });
  const entitledUntil = subscription.entitledUntil?.toISOString() ?? null;
  return Response.json({ subscription: {
    provider: subscription.provider,
    mode: subscription.mode,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    entitledUntil,
    access: subscription.access,
  } }, { headers: { "cache-control": "no-store" } });
}

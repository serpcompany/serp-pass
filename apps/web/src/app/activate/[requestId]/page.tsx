import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { AuthPanel } from "@/app/account/auth-panel";
import { getHumanIdentity } from "@/auth/identity";
import { readActivation } from "@/entitlements/authority";
import { ActivationDecisionForm } from "./decision-form";

export const dynamic = "force-dynamic";

export default async function ActivationPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const { env } = getCloudflareContext();
  const [identity, activation] = await Promise.all([getHumanIdentity(), readActivation(env.DB, requestId)]);
  if (!activation) {
    return (
      <main>
        <Link className="back-link" href="/">← Apps Pass</Link>
        <section className="account-card"><span className="status">Not found</span><h1>Activation request unavailable</h1><p className="muted">This request does not exist or was removed.</p></section>
      </main>
    );
  }
  const canDecide = identity?.roles.includes("subscriber") && activation.effectiveStatus === "requested" && activation.app_status === "approved" && activation.distribution_status === "approved";
  const statusCopy = activation.effectiveStatus === "approved" && activation.subscriber_user_id === identity?.session.user.id
    ? "Approved. Return to the extension and choose Finish linking."
    : activation.effectiveStatus === "approved"
      ? "This request was approved by a different Subscriber account."
      : activation.effectiveStatus === "exchanged"
        ? "This request has already created an App session."
        : activation.effectiveStatus === "denied"
          ? "This activation request was denied."
          : activation.effectiveStatus === "expired"
            ? "This activation request expired. Start again from the extension."
            : activation.app_status !== "approved" || activation.distribution_status !== "approved"
              ? "This App or Distribution is no longer eligible for activation."
              : "Review the verified App identity before approving this installation.";

  return (
    <main>
      <Link className="back-link" href="/">← Apps Pass</Link>
      {!identity && <AuthPanel />}
      <section className="account-card">
        <span className={`status ${canDecide ? "active" : ""}`}>Extension activation</span>
        <h1>{activation.app_name}</h1>
        <p>Published by <strong>{activation.publisher_name}</strong></p>
        <p className="muted">This page came from the extension. Apps Pass matched its browser runtime identity to the approved Publisher submission before showing it.</p>
        <dl>
          <dt>App ID</dt><dd>{activation.app_id}</dd>
          <dt>Installation</dt><dd>…{activation.installation_id.slice(-8)}</dd>
          <dt>Request status</dt><dd>{activation.effectiveStatus}</dd>
        </dl>
        <p role="status">{statusCopy}</p>
        {canDecide && <ActivationDecisionForm requestId={requestId} />}
        {identity && !identity.roles.includes("subscriber") && <p className="form-message">Subscriber role required.</p>}
      </section>
    </main>
  );
}

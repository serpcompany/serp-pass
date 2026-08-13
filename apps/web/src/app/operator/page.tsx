import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";

import { getHumanIdentity } from "@/auth/identity";
import { billingModeForEnvironment } from "@/billing/read";
import { getDb } from "@/db/get-db";
import { allocationRuns, appSubmissions, publisherConnectedAccounts, publisherEarnings, publishers } from "@/db/schema";
import { AllocationForm } from "./allocation-form";
import { PublisherInvitationForm } from "./publisher-invitation-form";
import { SettlementReleaseForm } from "./settlement-release-form";
import { SubmissionReviewForm } from "./submission-review-form";

export const dynamic = "force-dynamic";

export default async function OperatorPage() {
  const identity = await getHumanIdentity();

  if (!identity) {
    return (
      <main>
        <Link className="back-link" href="/">← Apps Pass</Link>
        <section className="account-card">
          <span className="status">Anonymous</span>
          <h1>Operator sign-in required</h1>
          <p className="muted">Operator controls require both a human session and an explicit Operator role.</p>
        </section>
      </main>
    );
  }

  if (!identity.roles.includes("operator")) {
    return (
      <main>
        <Link className="back-link" href="/">← Apps Pass</Link>
        <section className="account-card">
          <span className="status">Access denied</span>
          <h1>Operator role required</h1>
          <p className="muted">Signing in does not grant Operator authority. The bootstrap CLI must explicitly assign the initial trusted account.</p>
        </section>
      </main>
    );
  }
  const pendingSubmissions = await getDb()
    .select({ id: appSubmissions.id, appId: appSubmissions.appId })
    .from(appSubmissions)
    .where(eq(appSubmissions.status, "pending"));
  const { env } = getCloudflareContext();
  const mode = billingModeForEnvironment(env.APP_ENV);
  const earningRows = await getDb().select({
    id: publisherEarnings.id,
    publisherName: publishers.name,
    amount: publisherEarnings.amount,
    currency: publisherEarnings.currency,
    availableAt: publisherEarnings.availableAt,
    detailsSubmitted: publisherConnectedAccounts.detailsSubmitted,
    payoutsEnabled: publisherConnectedAccounts.payoutsEnabled,
    transfersCapability: publisherConnectedAccounts.transfersCapability,
    requirementsDue: publisherConnectedAccounts.requirementsCurrentlyDueCount,
    disabledReason: publisherConnectedAccounts.disabledReason,
  }).from(publisherEarnings)
    .innerJoin(allocationRuns, eq(allocationRuns.id, publisherEarnings.allocationRunId))
    .innerJoin(publishers, eq(publishers.id, publisherEarnings.publisherId))
    .leftJoin(publisherConnectedAccounts, and(eq(publisherConnectedAccounts.publisherId, publisherEarnings.publisherId), eq(publisherConnectedAccounts.mode, mode)))
    .where(and(eq(publisherEarnings.status, "accrued"), eq(allocationRuns.mode, mode)));

  return (
    <main>
      <Link className="back-link" href="/">← Apps Pass</Link>
      <section className="account-card">
        <span className="status active">Operator role active</span>
        <h1>Operator controls</h1>
        <p className="muted">Create a one-time, email-bound invitation. The raw code is shown once and must be shared with the intended Publisher through a private channel.</p>
        <PublisherInvitationForm />
        <div className="review-list">
          <h2>Post Publisher Allocation</h2>
          <AllocationForm />
        </div>
        {earningRows.length > 0 && <div className="review-list">
          <h2>Accrued Publisher Earnings</h2>
          {earningRows.map((earning) => {
            const holdPassed = earning.availableAt.getTime() <= Date.now();
            const connectReady = Boolean(earning.detailsSubmitted && earning.payoutsEnabled && earning.transfersCapability === "active" && earning.requirementsDue === 0 && !earning.disabledReason);
            const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: earning.currency.toUpperCase() }).format(earning.amount / 100);
            return <div key={earning.id} data-testid={`operator-earning-${earning.id}`}>
              <p><strong>{earning.publisherName} · {formatted} {earning.currency.toUpperCase()}</strong><br /><span className="muted">{earning.id} · hold {holdPassed ? "passed" : `until ${earning.availableAt.toISOString()}`} · Connect {connectReady ? "ready" : "not ready"}</span></p>
              <SettlementReleaseForm earningId={earning.id} enabled={holdPassed && connectReady} />
            </div>;
          })}
        </div>}
        {pendingSubmissions.length > 0 && (
          <div className="review-list">
            <h2>Pending App Submissions</h2>
            {pendingSubmissions.map((submission) => <SubmissionReviewForm key={submission.id} {...submission} submissionId={submission.id} />)}
          </div>
        )}
      </section>
    </main>
  );
}

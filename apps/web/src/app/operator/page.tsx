import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { getHumanIdentity } from "@/auth/identity";
import { billingModeForEnvironment } from "@/billing/read";
import { getDb } from "@/db/get-db";
import { allocationRuns, appAssignments, appConnectionVerifications, appSubmissions, publisherApplications, publisherEarnings, publisherPayments, publishers, submissionDistributionClaims } from "@/db/schema";
import { AllocationForm } from "./allocation-form";
import { PublisherApplicationReviewForm } from "./publisher-application-review-form";
import { PublisherPaymentForm } from "./publisher-payment-form";

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
  const { env } = getCloudflareContext();
  const mode = billingModeForEnvironment(env.APP_ENV);
  const [pendingApplications, integrations, earningRows] = await Promise.all([
    getDb().select().from(publisherApplications).where(eq(publisherApplications.status, "pending")),
    getDb()
      .select({
        id: appSubmissions.id,
        appId: appSubmissions.appId,
        publisherName: publishers.name,
        assignmentStatus: appAssignments.status,
        storeVersion: appSubmissions.storeVersion,
        manifestJson: appSubmissions.manifestJson,
        runtimeId: submissionDistributionClaims.runtimeId,
        channel: submissionDistributionClaims.channel,
        firstConnectedAt: appConnectionVerifications.firstConnectedAt,
        lastConnectedAt: appConnectionVerifications.lastConnectedAt,
        connectionCount: appConnectionVerifications.connectionCount,
      })
      .from(appSubmissions)
      .innerJoin(appAssignments, eq(appAssignments.appId, appSubmissions.appId))
      .innerJoin(publishers, eq(publishers.id, appSubmissions.publisherId))
      .leftJoin(submissionDistributionClaims, eq(submissionDistributionClaims.submissionId, appSubmissions.id))
      .leftJoin(appConnectionVerifications, and(
        eq(appConnectionVerifications.appId, appSubmissions.appId),
        eq(appConnectionVerifications.runtimeId, submissionDistributionClaims.runtimeId),
      ))
      .where(inArray(appSubmissions.status, ["pending", "approved"])),
    getDb().select({
      id: publisherEarnings.id,
      publisherName: publishers.name,
      amount: publisherEarnings.amount,
      currency: publisherEarnings.currency,
      availableAt: publisherEarnings.availableAt,
    }).from(publisherEarnings)
      .innerJoin(allocationRuns, eq(allocationRuns.id, publisherEarnings.allocationRunId))
      .innerJoin(publishers, eq(publishers.id, publisherEarnings.publisherId))
      .leftJoin(publisherPayments, eq(publisherPayments.publisherEarningId, publisherEarnings.id))
      .where(and(eq(publisherEarnings.status, "accrued"), eq(allocationRuns.mode, mode), isNull(publisherPayments.id))),
  ]);

  return (
    <main>
      <Link className="back-link" href="/">← Apps Pass</Link>
      <section className="account-card">
        <span className="status active">Operator role active</span>
        <h1>Operator controls</h1>
        <p className="muted">Developers apply from the public site. Product acceptance generates the Publisher/App identities and onboarding invitation. After the Publisher registers its manifest and runtime identity, Apps Pass marks the App connected only when that extension actually reaches the connection endpoint from its declared Chromium origin.</p>
        {pendingApplications.length === 0 ? <p className="muted">No pending Publisher Applications.</p> : (
          <div className="review-list">
            <h2>Pending Publisher Applications</h2>
            {pendingApplications.map((application) => <PublisherApplicationReviewForm
              key={application.id}
              applicationId={application.id}
              email={application.email}
              publisherName={application.publisherName}
              appName={application.appName}
              publicListingUrl={application.publicListingUrl}
              sourceUrl={application.sourceUrl}
              productDescription={application.productDescription}
              permissionsAndPrivacy={application.permissionsAndPrivacy}
            />)}
          </div>
        )}
        <div className="review-list">
          <h2>Post Publisher Allocation</h2>
          <AllocationForm />
        </div>
        {earningRows.length > 0 && <div className="review-list">
          <h2>Publisher Earnings awaiting payment</h2>
          {earningRows.map((earning) => {
            const holdPassed = earning.availableAt.getTime() <= Date.now();
            const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: earning.currency.toUpperCase() }).format(earning.amount / 100);
            return <div key={earning.id} data-testid={`operator-earning-${earning.id}`}>
              <p><strong>{earning.publisherName} · {formatted} {earning.currency.toUpperCase()}</strong><br /><span className="muted">{earning.id} · hold {holdPassed ? "passed" : `until ${earning.availableAt.toISOString()}`}</span></p>
              <PublisherPaymentForm earningId={earning.id} enabled={holdPassed} />
            </div>;
          })}
        </div>}
        {integrations.length > 0 && (
          <div className="review-list">
            <h2>App integrations</h2>
            <p className="muted">This is connection evidence, not a source-code, malware, or local feature-enforcement review.</p>
            {integrations.map((integration) => <div key={`${integration.id}:${integration.runtimeId ?? "none"}`}>
              <p><strong>{integration.publisherName} · {integration.appId}</strong><br />
                <span className="muted">Version {integration.storeVersion ?? "not recorded"} · {integration.channel ?? "no channel"} · <code>{integration.runtimeId ?? "no runtime"}</code></span>
              </p>
              <p className={integration.lastConnectedAt ? "" : "form-message"}>{integration.lastConnectedAt
                ? `Connected · first ${integration.firstConnectedAt?.toISOString()} · last ${integration.lastConnectedAt.toISOString()} · ${integration.connectionCount ?? 1} successful call(s)`
                : `Waiting for the integrated extension to connect · assignment ${integration.assignmentStatus}`}
              </p>
            </div>)}
          </div>
        )}
      </section>
    </main>
  );
}

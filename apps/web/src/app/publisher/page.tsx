import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentity } from "@/auth/identity";
import { billingModeForEnvironment } from "@/billing/read";
import { getDb } from "@/db/get-db";
import { allocationRuns, appAssignments, appSubmissions, publisherConnectedAccounts, publisherEarnings, publisherMemberships, publishers } from "@/db/schema";
import { SubmissionForm } from "./submission-form";

export const dynamic = "force-dynamic";

export default async function PublisherPage() {
  const identity = await getHumanIdentity();

  if (!identity) {
    return (
      <main>
        <Link className="back-link" href="/">← Apps Pass</Link>
        <section className="account-card">
          <span className="status">Anonymous</span>
          <h1>Publisher sign-in required</h1>
          <p className="muted">Sign in first. Publisher access also requires a one-time invitation issued by a SERP Operator.</p>
          <Link className="health" href="/account">Sign in</Link>
        </section>
      </main>
    );
  }

  if (!identity.roles.includes("publisher")) {
    return (
      <main>
        <Link className="back-link" href="/">← Apps Pass</Link>
        <section className="account-card">
          <span className="status">Subscriber only</span>
          <h1>Publisher invitation required</h1>
          <p className="muted">You are signed in, but this account has not accepted an active Publisher invitation. Typing a Publisher email address does not grant this role.</p>
        </section>
      </main>
    );
  }

  const assignments = await getDb()
    .select({ publisherId: publishers.id, publisherName: publishers.name, appId: appAssignments.appId, appStatus: appAssignments.status })
    .from(publisherMemberships)
    .innerJoin(publishers, eq(publishers.id, publisherMemberships.publisherId))
    .innerJoin(appAssignments, eq(appAssignments.publisherId, publishers.id))
    .where(eq(publisherMemberships.userId, identity.session.user.id));
  const submissions = await getDb()
    .select({ id: appSubmissions.id, appId: appSubmissions.appId, status: appSubmissions.status })
    .from(appSubmissions)
    .innerJoin(publisherMemberships, eq(publisherMemberships.publisherId, appSubmissions.publisherId))
    .where(eq(publisherMemberships.userId, identity.session.user.id));
  const { env } = getCloudflareContext();
  const mode = billingModeForEnvironment(env.APP_ENV);
  const connectAccounts = await getDb()
    .select({
      publisherId: publisherConnectedAccounts.publisherId,
      detailsSubmitted: publisherConnectedAccounts.detailsSubmitted,
      chargesEnabled: publisherConnectedAccounts.chargesEnabled,
      payoutsEnabled: publisherConnectedAccounts.payoutsEnabled,
      transfersCapability: publisherConnectedAccounts.transfersCapability,
      requirementsCurrentlyDueCount: publisherConnectedAccounts.requirementsCurrentlyDueCount,
      disabledReason: publisherConnectedAccounts.disabledReason,
    })
    .from(publisherConnectedAccounts)
    .innerJoin(publisherMemberships, eq(publisherMemberships.publisherId, publisherConnectedAccounts.publisherId))
    .where(and(eq(publisherMemberships.userId, identity.session.user.id), eq(publisherConnectedAccounts.mode, mode)));
  const earningRows = await getDb()
    .select({
      id: publisherEarnings.id,
      publisherId: publisherEarnings.publisherId,
      allocationRunId: publisherEarnings.allocationRunId,
      amount: publisherEarnings.amount,
      currency: publisherEarnings.currency,
      availableAt: publisherEarnings.availableAt,
      status: publisherEarnings.status,
    })
    .from(publisherEarnings)
    .innerJoin(allocationRuns, eq(allocationRuns.id, publisherEarnings.allocationRunId))
    .innerJoin(publisherMemberships, eq(publisherMemberships.publisherId, publisherEarnings.publisherId))
    .where(and(eq(publisherMemberships.userId, identity.session.user.id), eq(allocationRuns.mode, mode)));
  const connectByPublisher = new Map(connectAccounts.map((account) => [account.publisherId, account]));

  return (
    <main>
      <Link className="back-link" href="/">← Apps Pass</Link>
      <section className="account-card">
        <span className="status active">Publisher role active</span>
        <h1>Publisher pilot area</h1>
        <p className="muted">Your public identifiers were assigned by a SERP Operator. Your manifest may reference them but cannot create or replace them.</p>
        <h2>Stripe Connect</h2>
        {connectAccounts.length === 0 ? (
          <div>
            <strong>Connect not started</strong>
            <p className="muted">A Stripe return does not prove onboarding readiness.</p>
          </div>
        ) : connectAccounts.map((account) => {
          const settlementReady = account.detailsSubmitted && account.chargesEnabled && account.payoutsEnabled && account.transfersCapability === "active" && account.requirementsCurrentlyDueCount === 0 && !account.disabledReason;
          return (
            <div key={account.publisherId}>
              <strong>{settlementReady ? `Ready for ${mode} settlement` : "Connect onboarding incomplete"}</strong>
              <ul>
                <li>{account.chargesEnabled ? "Charges enabled" : "Charges disabled"}</li>
                <li>Transfers {account.transfersCapability}</li>
                <li>{account.payoutsEnabled ? "Bank payouts enabled" : "Bank payouts disabled"}</li>
                <li>{account.requirementsCurrentlyDueCount} {account.requirementsCurrentlyDueCount === 1 ? "requirement" : "requirements"} currently due</li>
              </ul>
              {account.disabledReason && <p className="muted">Stripe reports the account disabled: {account.disabledReason}</p>}
            </div>
          );
        })}
        <h2>Publisher Earnings</h2>
        {earningRows.length === 0 ? <p className="muted">No Publisher Earnings yet.</p> : (
          <ul>
            {earningRows.map((earning) => {
              const account = connectByPublisher.get(earning.publisherId);
              const connectReady = Boolean(account?.detailsSubmitted && account.chargesEnabled && account.payoutsEnabled && account.transfersCapability === "active" && account.requirementsCurrentlyDueCount === 0 && !account.disabledReason);
              const holdPassed = earning.availableAt.getTime() <= Date.now();
              const status = earning.status === "released"
                ? "Released to a Transfer"
                : !holdPassed
                  ? `Held until ${earning.availableAt.toISOString()}`
                  : connectReady
                    ? "Eligible — awaiting Operator release"
                    : "Accrued — Connect not ready";
              const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: earning.currency.toUpperCase() }).format(earning.amount / 100);
              return (
                <li key={earning.id}>
                  <strong>{formatted} {earning.currency.toUpperCase()}</strong> · {status}<br />
                  <span className="muted">Allocation {earning.allocationRunId} · No Transfer created · No bank Payout observed</span>
                </li>
              );
            })}
          </ul>
        )}
        <ul>
          {assignments.map((assignment) => (
            <li key={assignment.appId}><strong>{assignment.publisherName}</strong> · {assignment.publisherId} · <code>{assignment.appId}</code> · {assignment.appStatus}</li>
          ))}
        </ul>
        {submissions.length > 0 && <ul>{submissions.map((submission) => <li key={submission.id}>{submission.appId} · {submission.status}</li>)}</ul>}
        {assignments.some((assignment) => assignment.appStatus === "assigned") && <SubmissionForm />}
      </section>
    </main>
  );
}

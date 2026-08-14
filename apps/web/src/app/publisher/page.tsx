import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentity } from "@/auth/identity";
import { billingModeForEnvironment } from "@/billing/read";
import { getDb } from "@/db/get-db";
import { allocationRuns, appAssignments, appSubmissions, publisherEarnings, publisherMemberships, publisherPayments, publishers } from "@/db/schema";
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
  const earningRows = await getDb()
    .select({
      id: publisherEarnings.id,
      publisherId: publisherEarnings.publisherId,
      allocationRunId: publisherEarnings.allocationRunId,
      amount: publisherEarnings.amount,
      currency: publisherEarnings.currency,
      availableAt: publisherEarnings.availableAt,
      status: publisherEarnings.status,
      paymentId: publisherPayments.id,
      paymentMethod: publisherPayments.method,
      paymentReference: publisherPayments.providerReference,
      paidAt: publisherPayments.paidAt,
    })
    .from(publisherEarnings)
    .innerJoin(allocationRuns, eq(allocationRuns.id, publisherEarnings.allocationRunId))
    .innerJoin(publisherMemberships, eq(publisherMemberships.publisherId, publisherEarnings.publisherId))
    .leftJoin(publisherPayments, eq(publisherPayments.publisherEarningId, publisherEarnings.id))
    .where(and(eq(publisherMemberships.userId, identity.session.user.id), eq(allocationRuns.mode, mode)));

  return (
    <main>
      <Link className="back-link" href="/">← Apps Pass</Link>
      <section className="account-card">
        <span className="status active">Publisher role active</span>
        <h1>Publisher pilot area</h1>
        <p className="muted">Apps Pass generated your immutable public identifiers. Configure the SDK with the App ID, and submit your extension&apos;s real runtime identity and ownership evidence for Operator review.</p>
        <h2>Pilot payments</h2>
        <p className="muted">Stripe bills Subscribers only. During the private pilot, SERP pays Publishers outside Apps Pass and records the completed payment here. Apps Pass never asks for or stores your bank or payment-account credentials.</p>
        <h2>Publisher Earnings</h2>
        {earningRows.length === 0 ? <p className="muted">No Publisher Earnings yet.</p> : (
          <ul>
            {earningRows.map((earning) => {
              const holdPassed = earning.availableAt.getTime() <= Date.now();
              const status = earning.paymentId
                ? `Paid externally on ${earning.paidAt?.toISOString()}`
                : earning.status === "reversed"
                ? "Reversed after Transfer reversal"
                : earning.status === "released"
                ? "Released to connected Stripe balance"
                : !holdPassed
                  ? `Held until ${earning.availableAt.toISOString()}`
                  : "Accrued — awaiting SERP payment";
              const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: earning.currency.toUpperCase() }).format(earning.amount / 100);
              return (
                <li key={earning.id}>
                  <strong>{formatted} {earning.currency.toUpperCase()}</strong> · {status}<br />
                  <span className="muted">Allocation {earning.allocationRunId}{earning.paymentId ? ` · ${earning.paymentMethod} reference ${earning.paymentReference}` : " · No Publisher Payment recorded"}</span>
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

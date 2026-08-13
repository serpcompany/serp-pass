import Link from "next/link";
import { eq } from "drizzle-orm";

import { getHumanIdentity } from "@/auth/identity";
import { getDb } from "@/db/get-db";
import { appSubmissions } from "@/db/schema";
import { PublisherInvitationForm } from "./publisher-invitation-form";
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

  return (
    <main>
      <Link className="back-link" href="/">← Apps Pass</Link>
      <section className="account-card">
        <span className="status active">Operator role active</span>
        <h1>Operator controls</h1>
        <p className="muted">Create a one-time, email-bound invitation. The raw code is shown once and must be shared with the intended Publisher through a private channel.</p>
        <PublisherInvitationForm />
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

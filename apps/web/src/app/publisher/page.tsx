import Link from "next/link";

import { getHumanIdentity } from "@/auth/identity";

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

  return (
    <main>
      <Link className="back-link" href="/">← Apps Pass</Link>
      <section className="account-card">
        <span className="status active">Publisher role active</span>
        <h1>Publisher pilot area</h1>
        <p className="muted">This identity boundary is active. App Submission and Stripe Connect are delivered in later slices.</p>
      </section>
    </main>
  );
}

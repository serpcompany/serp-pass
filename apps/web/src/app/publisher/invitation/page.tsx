import Link from "next/link";

import { getHumanIdentity } from "@/auth/identity";
import { InvitationAcceptanceForm } from "./invitation-form";

export const dynamic = "force-dynamic";

export default async function PublisherInvitationPage() {
  const identity = await getHumanIdentity();
  return (
    <main>
      <Link className="back-link" href="/publisher">← Publisher area</Link>
      <section className="account-card">
        <h1>Accept Publisher invitation</h1>
        <p className="muted">This onboarding invitation exists only after SERP preliminarily accepted a Publisher Application. It does not approve the extension.</p>
        {!identity ? <p className="muted">Sign in with the exact accepted Application email before continuing.</p> : <InvitationAcceptanceForm />}
      </section>
    </main>
  );
}

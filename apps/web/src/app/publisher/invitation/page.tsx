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
        {!identity ? <p className="muted">Sign in before accepting an invitation.</p> : <InvitationAcceptanceForm />}
      </section>
    </main>
  );
}

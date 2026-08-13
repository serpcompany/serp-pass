"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ActivationDecisionForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const decision = submitter?.value === "deny" ? "deny" : "approve";
    const response = await fetch(`/api/app-pass/link-requests/${encodeURIComponent(requestId)}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) setMessage(result.message ?? "The activation decision could not be recorded.");
    else router.refresh();
    setSubmitting(false);
  }

  return (
    <form onSubmit={decide}>
      <div className="actions">
        <button type="submit" name="decision" value="approve" disabled={submitting}>Approve this extension</button>
        <button type="submit" name="decision" value="deny" disabled={submitting}>Deny</button>
      </div>
      {message && <p role="status" className="form-message">{message}</p>}
    </form>
  );
}

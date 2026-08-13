"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SubmissionReviewForm({ submissionId, appId }: { submissionId: string; appId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const decision = submitter?.value === "reject" ? "reject" : "approve";
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    const response = await fetch(`/api/operator/submissions/${submissionId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) setMessage(result.message ?? "Review could not be recorded.");
    else router.refresh();
  }

  return (
    <form data-testid={`submission-${submissionId}`} onSubmit={review}>
      <strong>{appId} · pending</strong>
      <label>Review reason<input name="reason" minLength={10} maxLength={1000} required /></label>
      <div className="actions">
        <button type="submit" name="decision" value="approve">Approve Submission</button>
        <button type="submit" name="decision" value="reject">Reject Submission</button>
      </div>
      {message && <p role="status" className="form-message">{message}</p>}
    </form>
  );
}

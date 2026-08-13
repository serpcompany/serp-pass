"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SubmissionForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const fields = new FormData(event.currentTarget);
    let manifest: unknown;
    try {
      manifest = JSON.parse(String(fields.get("manifest") ?? ""));
    } catch {
      setMessage("App manifest must be valid JSON.");
      return;
    }
    const response = await fetch("/api/publisher/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest, ownershipEvidence: String(fields.get("ownershipEvidence") ?? "") }),
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) setMessage(result.message ?? "Submission could not be recorded.");
    else {
      setMessage("Submission recorded as pending Operator review.");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit}>
      <label>App manifest JSON<textarea name="manifest" rows={16} required /></label>
      <label>Ownership evidence<textarea name="ownershipEvidence" rows={4} minLength={20} maxLength={2000} required /></label>
      <button type="submit">Submit App for review</button>
      {message && <p role="status" className={message.startsWith("Submission recorded") ? "" : "form-message"}>{message}</p>}
    </form>
  );
}

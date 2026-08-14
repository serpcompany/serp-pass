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
    try {
      JSON.parse(String(fields.get("manifest") ?? ""));
    } catch {
      setMessage("App manifest must be valid JSON.");
      return;
    }
    const response = await fetch("/api/publisher/submissions", {
      method: "POST",
      body: fields,
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
      <label>Exact installable extension ZIP<input name="reviewPackage" type="file" accept=".zip,application/zip" required /></label>
      <p className="muted">SERP stores this package privately and records its SHA-256 digest, extension manifest, permissions, and intake checks. The package is reviewed; uploading it does not approve the App.</p>
      <button type="submit">Submit App for review</button>
      {message && <p role="status" className={message.startsWith("Submission recorded") ? "" : "form-message"}>{message}</p>}
    </form>
  );
}

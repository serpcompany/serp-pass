"use client";

import { useState } from "react";

export function AllocationForm() {
  const [manifest, setManifest] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    let body: unknown;
    try {
      body = JSON.parse(manifest);
    } catch {
      setMessage("Allocation JSON is invalid.");
      setSubmitting(false);
      return;
    }
    const response = await fetch("/api/operator/allocations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { message?: string; allocationRunId?: string; outcome?: string };
    setMessage(response.ok ? `Allocation ${result.allocationRunId} ${result.outcome}.` : (result.message ?? "Allocation failed."));
    setSubmitting(false);
    if (response.ok) window.location.reload();
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="allocation-json">Allocation JSON</label>
      <textarea id="allocation-json" value={manifest} onChange={(event) => setManifest(event.target.value)} rows={12} placeholder='{"schemaVersion":1,"allocationRunId":"alloc_..."}' required />
      <p className="muted">The Operator supplies exact Cash Receipt, reserve, platform, Publisher, agreement, and hold amounts. Apps Pass validates a zero-sum posting; it does not invent a revenue-share formula.</p>
      <button type="submit" disabled={submitting}>{submitting ? "Posting…" : "Post immutable Allocation"}</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

"use client";

import { useState } from "react";

export function SettlementReleaseForm({ earningId, enabled }: { earningId: string; enabled: boolean }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const response = await fetch("/api/operator/settlements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schemaVersion: 1, earningId, reason }),
    });
    const result = await response.json() as { message?: string; outcome?: string; simulated?: boolean };
    setMessage(response.ok ? `${result.outcome}${result.simulated ? " through local simulation" : ""}.` : (result.message ?? "Release failed."));
    setSubmitting(false);
    if (response.ok) window.location.reload();
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor={`settlement-reason-${earningId}`}>Release reason</label>
      <input id={`settlement-reason-${earningId}`} value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={1000} required />
      <button type="submit" disabled={!enabled || submitting}>{submitting ? "Releasing…" : "Release Publisher Earning"}</button>
      {!enabled && <p className="muted">Hold and verified Connect readiness must both pass.</p>}
      {message && <p role="status">{message}</p>}
    </form>
  );
}

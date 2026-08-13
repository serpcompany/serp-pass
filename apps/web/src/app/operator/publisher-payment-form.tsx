"use client";

import { useState } from "react";

export function PublisherPaymentForm({ earningId, enabled }: { earningId: string; enabled: boolean }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const fields = new FormData(event.currentTarget);
    const paidAt = new Date(String(fields.get("paidAt") ?? ""));
    if (!Number.isFinite(paidAt.getTime())) {
      setMessage("Enter a valid payment completion time.");
      setSubmitting(false);
      return;
    }
    const response = await fetch("/api/operator/publisher-payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaVersion: 1,
        paymentId: String(fields.get("paymentId") ?? ""),
        earningId,
        method: String(fields.get("method") ?? ""),
        providerReference: String(fields.get("providerReference") ?? ""),
        paidAt: paidAt.toISOString(),
        reason: String(fields.get("reason") ?? ""),
      }),
    });
    const result = await response.json() as { message?: string; paymentId?: string; outcome?: string };
    setMessage(response.ok ? `Publisher Payment ${result.paymentId} ${result.outcome}.` : (result.message ?? "Publisher Payment failed."));
    setSubmitting(false);
    if (response.ok) window.location.reload();
  }

  return (
    <form onSubmit={submit}>
      <p className="muted">Complete the payment outside Apps Pass first. Record only its opaque confirmation reference—never bank credentials, account numbers, or a Publisher email address.</p>
      <label>Apps Pass Payment ID<input name="paymentId" pattern="payment_[A-Za-z0-9_-]{6,120}" placeholder="payment_..." required /></label>
      <label>Payment method<select name="method" defaultValue="ach"><option value="ach">ACH</option><option value="bank_transfer">Bank transfer</option><option value="paypal">PayPal</option><option value="wise">Wise</option><option value="other">Other</option></select></label>
      <label>Provider confirmation reference<input name="providerReference" pattern="[A-Za-z0-9._:/-]{4,160}" required /></label>
      <label>Paid at<input name="paidAt" type="datetime-local" required /></label>
      <label>Operator reason<input name="reason" minLength={10} maxLength={1000} required /></label>
      <button type="submit" disabled={!enabled || submitting}>{submitting ? "Recording…" : "Record completed Publisher Payment"}</button>
      {!enabled && <p className="muted">The Earning hold must pass before its completed payment can be recorded.</p>}
      {message && <p role="status">{message}</p>}
    </form>
  );
}

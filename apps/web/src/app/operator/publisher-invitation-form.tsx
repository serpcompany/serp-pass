"use client";

import { FormEvent, useState } from "react";

export function PublisherInvitationForm() {
  const [invitationCode, setInvitationCode] = useState("");
  const [publisherId, setPublisherId] = useState("");
  const [appId, setAppId] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvitationCode("");
    setPublisherId("");
    setAppId("");
    setMessage("");
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    const fields = new FormData(event.currentTarget);
    const response = await fetch("/api/operator/publisher-invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        publisherName: String(fields.get("publisherName") ?? ""),
        appName: String(fields.get("appName") ?? ""),
      }),
    });
    const result = await response.json() as { publisherId?: string; appId?: string; invitationCode?: string; message?: string };
    if (!response.ok || !result.invitationCode) setMessage(result.message ?? "Invitation could not be created.");
    else {
      setPublisherId(result.publisherId ?? "");
      setAppId(result.appId ?? "");
      setInvitationCode(result.invitationCode);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>Publisher email<input name="email" type="email" required /></label>
      <label>Publisher name<input name="publisherName" minLength={1} maxLength={100} required /></label>
      <label>First App name<input name="appName" minLength={1} maxLength={100} required /></label>
      <p className="muted">Apps Pass generates the immutable Publisher and first App IDs. The extension&apos;s actual Chromium runtime ID is supplied later in the Publisher&apos;s manifest for review.</p>
      <button type="submit">Create Publisher invitation</button>
      {invitationCode && (
        <div className="sensitive-result">
          <strong>Generated identities:</strong>
          <output data-testid="generated-publisher-id">{publisherId}</output>
          <output data-testid="generated-app-id">{appId}</output>
          <strong>Copy once; only its hash is stored:</strong>
          <output data-testid="invitation-code">{invitationCode}</output>
        </div>
      )}
      {message && <p role="status" className="form-message">{message}</p>}
    </form>
  );
}

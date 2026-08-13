"use client";

import { FormEvent, useState } from "react";

export function PublisherInvitationForm() {
  const [invitationCode, setInvitationCode] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvitationCode("");
    setMessage("");
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    const response = await fetch("/api/operator/publisher-invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await response.json() as { invitationCode?: string; message?: string };
    if (!response.ok || !result.invitationCode) setMessage(result.message ?? "Invitation could not be created.");
    else setInvitationCode(result.invitationCode);
  }

  return (
    <form onSubmit={submit}>
      <label>Publisher email<input name="email" type="email" required /></label>
      <button type="submit">Create Publisher invitation</button>
      {invitationCode && (
        <div className="sensitive-result">
          <strong>Copy once; only its hash is stored:</strong>
          <output data-testid="invitation-code">{invitationCode}</output>
        </div>
      )}
      {message && <p role="status" className="form-message">{message}</p>}
    </form>
  );
}

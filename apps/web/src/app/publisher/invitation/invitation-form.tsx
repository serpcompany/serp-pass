"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function InvitationAcceptanceForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const invitationCode = String(new FormData(event.currentTarget).get("invitationCode") ?? "");
    const response = await fetch("/api/publisher-invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invitationCode }),
    });
    const result = await response.json() as { accepted?: boolean; message?: string };
    if (!response.ok || !result.accepted) setMessage(result.message ?? "Invitation could not be accepted.");
    else {
      router.push("/publisher");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit}>
      <label>Invitation code<input name="invitationCode" autoComplete="off" required /></label>
      <button type="submit">Accept Publisher invitation</button>
      {message && <p role="status" className="form-message">{message}</p>}
    </form>
  );
}

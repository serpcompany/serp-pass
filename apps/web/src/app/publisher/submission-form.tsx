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
      body: JSON.stringify({ manifest, storeVersion: fields.get("storeVersion") }),
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) setMessage(result.message ?? "Integration Declaration could not be recorded.");
    else {
      setMessage("Integration Declaration registered. Open the integrated extension once so Apps Pass can verify its connection.");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit}>
      <h2>Register the integrated extension</h2>
      <p className="muted">Paste the public manifest from your extension and identify the version you built or published. No source code or ZIP upload is required for this MVP.</p>
      <label>App manifest JSON<textarea name="manifest" rows={16} required /></label>
      <label>Built or published extension version<input name="storeVersion" placeholder="1.0.0" maxLength={64} required /></label>
      <button type="submit">Register integration</button>
      {message && <p role="status" className={message.startsWith("Integration Declaration registered") ? "" : "form-message"}>{message}</p>}
    </form>
  );
}

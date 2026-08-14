"use client";

import { FormEvent, useState } from "react";

export function PublisherApplicationForm() {
  const [message, setMessage] = useState("");
  const [applicationId, setApplicationId] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setApplicationId("");
    const fields = new FormData(event.currentTarget);
    const response = await fetch("/api/publisher/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: fields.get("email"),
        publisherName: fields.get("publisherName"),
        appName: fields.get("appName"),
        publicListingUrl: fields.get("publicListingUrl"),
        sourceUrl: fields.get("sourceUrl"),
        productDescription: fields.get("productDescription"),
        permissionsAndPrivacy: fields.get("permissionsAndPrivacy"),
        ownershipAttested: fields.get("ownershipAttested") === "on",
      }),
    });
    const result = await response.json() as { applicationId?: string; message?: string };
    if (!response.ok || !result.applicationId) setMessage(result.message ?? "Application could not be submitted.");
    else {
      setApplicationId(result.applicationId);
      setMessage("Application received for preliminary SERP review. You do not have Publisher access yet.");
      event.currentTarget.reset();
    }
  }

  return (
    <form onSubmit={submit} className="application-form">
      <label>Contact email<input name="email" type="email" required /></label>
      <label>Publisher or company name<input name="publisherName" minLength={2} maxLength={100} required /></label>
      <label>Extension name<input name="appName" minLength={2} maxLength={100} required /></label>
      <label>Public extension listing URL<input name="publicListingUrl" type="url" placeholder="https://chromewebstore.google.com/detail/..." required /></label>
      <label>Source repository URL <span className="muted">(optional at this stage)</span><input name="sourceUrl" type="url" placeholder="https://github.com/..." /></label>
      <label>What the extension does and why it belongs in the Pass<textarea name="productDescription" rows={5} minLength={40} maxLength={2000} required /></label>
      <label>Permissions, data collection, and privacy explanation<textarea name="permissionsAndPrivacy" rows={5} minLength={40} maxLength={2000} required /></label>
      <label className="checkbox-label"><input name="ownershipAttested" type="checkbox" required /> I attest that I own or am authorized to submit and license this extension for review.</label>
      <button type="submit">Submit Publisher Application</button>
      {message && <p role="status" className={applicationId ? "" : "form-message"}>{message}</p>}
      {applicationId && <p className="muted">Application reference: <code data-testid="application-id">{applicationId}</code></p>}
    </form>
  );
}

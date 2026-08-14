"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  applicationId: string;
  email: string;
  publisherName: string;
  appName: string;
  publicListingUrl: string;
  sourceUrl: string | null;
  productDescription: string;
  permissionsAndPrivacy: string;
};

export function PublisherApplicationReviewForm(props: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [onboarding, setOnboarding] = useState<{ publisherId: string; appId: string; invitationCode: string } | null>(null);

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const decision = submitter?.value === "reject" ? "reject" : "accept";
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    const response = await fetch(`/api/operator/publisher-applications/${props.applicationId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    const result = await response.json() as { message?: string; publisherId?: string; appId?: string; invitationCode?: string };
    if (!response.ok) setMessage(result.message ?? "Application review could not be recorded.");
    else if (decision === "accept" && result.publisherId && result.appId && result.invitationCode) {
      setOnboarding({ publisherId: result.publisherId, appId: result.appId, invitationCode: result.invitationCode });
    } else router.refresh();
  }

  return (
    <form data-testid={`publisher-application-${props.applicationId}`} onSubmit={review}>
      <strong>{props.appName} · {props.publisherName}</strong>
      <p className="muted">{props.email} · Application {props.applicationId}</p>
      <details>
        <summary>Inspect the Publisher Application</summary>
        <h3>Public listing</h3>
        <p><a href={props.publicListingUrl} rel="noreferrer" target="_blank">{props.publicListingUrl}</a></p>
        {props.sourceUrl ? <><h3>Source supplied by applicant</h3><p><a href={props.sourceUrl} rel="noreferrer" target="_blank">{props.sourceUrl}</a></p></> : null}
        <h3>Product and catalog case</h3><p className="submission-evidence">{props.productDescription}</p>
        <h3>Permissions and privacy</h3><p className="submission-evidence">{props.permissionsAndPrivacy}</p>
        <h3>Ownership statement</h3><p className="submission-evidence">Applicant attested that they own or are authorized to submit and license this extension. This statement still requires human verification.</p>
      </details>
      {!onboarding ? <>
        <label>Preliminary review reason<textarea name="reason" rows={3} minLength={20} maxLength={1000} required /></label>
        <div className="actions">
          <button type="submit" name="decision" value="accept">Accept for technical onboarding</button>
          <button type="submit" name="decision" value="reject">Decline Application</button>
        </div>
      </> : null}
      {onboarding ? <div className="sensitive-result">
        <strong>Preliminary acceptance recorded. This is not final App approval.</strong>
        <output data-testid="generated-publisher-id">{onboarding.publisherId}</output>
        <output data-testid="generated-app-id">{onboarding.appId}</output>
        <strong>Deliver this invitation code once; only its hash is stored:</strong>
        <output data-testid="invitation-code">{onboarding.invitationCode}</output>
      </div> : null}
      {message ? <p role="status" className="form-message">{message}</p> : null}
    </form>
  );
}

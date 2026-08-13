import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Submit an App",
};

const steps = [
  {
    number: "01",
    title: "Receive an invitation",
    description:
      "A SERP Operator invites your Publisher account and assigns the public Publisher and App IDs for your extension.",
  },
  {
    number: "02",
    title: "Add the integration",
    description:
      "Add the Apps Pass SDK and the required host permission. No platform secrets or payment credentials belong in your extension.",
  },
  {
    number: "03",
    title: "Rebuild and test",
    description:
      "Rebuild your Chromium extension and test the Subscriber linking and access flow against the pilot environment.",
  },
  {
    number: "04",
    title: "Submit for review",
    description:
      "In the authenticated Publisher area, submit apppass.json together with evidence that you control the extension distribution.",
  },
  {
    number: "05",
    title: "Become eligible",
    description:
      "SERP reviews the Submission and ownership evidence. Approval makes the App and its approved Distribution eligible for Subscriber linking.",
  },
];

export default function SubmitPage() {
  return (
    <main>
      <section className="page-hero">
        <span className="eyebrow">For invited Chromium extension Publishers</span>
        <h1>Bring your extension into one subscription.</h1>
        <p>
          Apps Pass gives Subscribers access to approved, independently published extensions through one Pass. The private pilot is invitation-only, so SERP assigns your public IDs before you integrate or submit.
        </p>
        <div className="actions">
          <Link className="primary-button" href="/docs">
            Read integration docs
          </Link>
          <Link className="secondary-button" href="/publisher/invitation">
            Accept an invitation
          </Link>
        </div>
      </section>

      <section className="section" aria-labelledby="integration-steps">
        <div className="section-heading">
          <span className="eyebrow">How the private pilot works</span>
          <h2 id="integration-steps">From invitation to an approved App</h2>
          <p>Five clear steps take your extension from assigned identity to eligibility in the Pass.</p>
        </div>
        <div className="step-grid">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="responsibilities">
        <div className="section-heading">
          <span className="eyebrow">A small integration boundary</span>
          <h2 id="responsibilities">What SERP provides—and what you change</h2>
        </div>
        <div className="split">
          <article className="info-panel">
            <h3>SERP gives you</h3>
            <ul className="clean-list">
              <li>An invitation tied to your Publisher account</li>
              <li>Assigned public Publisher and App IDs</li>
              <li>The SDK and versioned apppass.json contract</li>
              <li>Subscriber linking and entitlement authority</li>
              <li>A review trail for Submissions and ownership evidence</li>
            </ul>
          </article>
          <article className="info-panel">
            <h3>You change</h3>
            <ul className="clean-list">
              <li>Add the SDK to your extension source</li>
              <li>Declare the Apps Pass host permission</li>
              <li>Use the assigned public IDs in apppass.json</li>
              <li>Rebuild and test the real extension</li>
              <li>Submit the manifest and ownership evidence for review</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="section" aria-labelledby="publisher-money">
        <div className="accent-panel">
          <span className="eyebrow">How money works in the pilot</span>
          <h2 id="publisher-money">Recorded clearly, without an automatic payout claim.</h2>
          <p>
            Stripe bills Subscribers. SERP explicitly decides and records each allocation, then pays eligible Publisher Earnings outside Apps Pass through an approved external method. Apps Pass records evidence of the completed payment; it does not move money or confirm an unobserved bank deposit.
          </p>
          <div className="actions">
            <Link className="primary-button" href="/publisher">
              Open Publisher area
            </Link>
            <Link className="secondary-button" href="/docs">
              Review the integration
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

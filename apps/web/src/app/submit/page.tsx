import type { Metadata } from "next";
import Link from "next/link";
import { PublisherApplicationForm } from "./application-form";

export const metadata: Metadata = {
  title: "Submit an App",
};

const steps = [
  {
    number: "01",
    title: "Apply",
    description:
      "Tell SERP who you are, where the extension is publicly listed, what it does, what it can access, and why you are authorized to submit it.",
  },
  {
    number: "02",
    title: "Pass preliminary review",
    description:
      "A SERP Operator accepts or declines the product. Acceptance—not application—generates your Publisher/App IDs and private onboarding invitation.",
  },
  {
    number: "03",
    title: "Integrate and package",
    description:
      "Add the SDK, rebuild and test the extension, then prepare the exact installable ZIP that you want SERP to review.",
  },
  {
    number: "04",
    title: "Submit for review",
    description:
      "In the authenticated Publisher area, submit apppass.json, ownership evidence, and the exact installable extension ZIP.",
  },
  {
    number: "05",
    title: "Become eligible",
    description:
      "SERP inspects the package, permissions, behavior, ownership evidence, and integration. Only explicit final approval makes the reviewed version eligible.",
  },
];

export default function SubmitPage() {
  return (
    <main>
      <section className="page-hero">
        <span className="eyebrow">Applications open for the private pilot</span>
        <h1>Bring your extension into one subscription.</h1>
        <p>
          Apps Pass gives Subscribers access to approved, independently published extensions through one Pass. You can apply below; applying does not grant Publisher access or place an extension in the catalog. SERP screens the product first and reviews the exact integrated package before final approval.
        </p>
        <div className="actions">
          <Link className="primary-button" href="/docs">
            Read integration docs
          </Link>
          <a className="secondary-button" href="#apply">Apply now</a>
        </div>
      </section>

      <section className="section" aria-labelledby="integration-steps">
        <div className="section-heading">
          <span className="eyebrow">How the private pilot works</span>
          <h2 id="integration-steps">From Application to an approved App</h2>
          <p>Five gated steps separate asking to join, technical onboarding, and approval of the version Subscribers will run.</p>
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

      <section className="section" id="apply" aria-labelledby="application-heading">
        <div className="section-heading">
          <span className="eyebrow">Step 1 · Preliminary review</span>
          <h2 id="application-heading">Apply to publish an extension</h2>
          <p>SERP reviews this information internally. If accepted, we issue private technical-onboarding access. A final App approval still requires the integrated extension package.</p>
        </div>
        <div className="info-panel"><PublisherApplicationForm /></div>
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
              <li>A reasoned preliminary Application decision</li>
              <li>After acceptance, an email-bound invitation and generated public IDs</li>
              <li>The SDK and versioned apppass.json contract</li>
              <li>Subscriber linking and entitlement authority</li>
              <li>A review trail for the exact package, evidence, and final decision</li>
            </ul>
          </article>
          <article className="info-panel">
            <h3>You change</h3>
            <ul className="clean-list">
              <li>Add the SDK to your extension source</li>
              <li>Declare the Apps Pass host permission</li>
              <li>Use the generated App ID in the SDK; submit the real runtime identity in apppass.json</li>
              <li>Rebuild and test the real extension</li>
              <li>Submit the manifest, ownership evidence, and exact installable ZIP for review</li>
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

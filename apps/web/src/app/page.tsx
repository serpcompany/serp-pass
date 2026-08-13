import Link from "next/link";

import { readCatalogApps } from "@/apps/catalog";

export const dynamic = "force-dynamic";

const steps = [
  {
    number: "01",
    title: "Subscribe",
    description: "Create your Subscriber account and start the $10/month Pass through hosted Stripe Checkout.",
  },
  {
    number: "02",
    title: "Connect",
    description: "Install an approved extension, then review and approve its one-time link to your account.",
  },
  {
    number: "03",
    title: "Use",
    description: "Keep using included premium features while your paid-through subscription remains active.",
  },
] as const;

export default async function Home() {
  const catalogApps = await readCatalogApps();
  const availableApps = catalogApps
    .filter((app) => app.status === "approved" && app.distributions.some((distribution) => distribution.status === "approved"))
    .slice(0, 3);

  return (
    <main>
      <section className="marketing-hero">
        <div>
          <span className="eyebrow">Private pilot · Stripe test mode</span>
          <h1>One subscription. Every approved App.</h1>
          <p>
            Get premium features across independently published browser extensions with one simple Apps Pass.
            The working pilot price is $10/month.
          </p>
          <div className="actions">
            <Link className="primary-button" href="/account">Open your account</Link>
            <Link className="secondary-button" href="/apps">Browse Apps</Link>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="hero-stack">
            <div className="mini-app">
              <div className="app-icon">1</div>
              <div><strong>One Apps Pass</strong><span>A single Subscriber account</span></div>
            </div>
            <div className="mini-app">
              <div className="app-icon">+</div>
              <div><strong>Approved Apps</strong><span>Curated for the private pilot</span></div>
            </div>
            <div className="mini-app">
              <div className="app-icon">A</div>
              <div><strong>Active access</strong><span>Connected to your paid-through status</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="included-apps-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Included in the Pass</span>
            <h2 id="included-apps-heading">Apps available in the pilot</h2>
          </div>
          <p>Only approved Apps with an approved distribution appear here. The catalog comes directly from the pilot database.</p>
        </div>

        {availableApps.length > 0 ? (
          <div className="app-grid">
            {availableApps.map((app) => (
              <article className="app-card" key={app.id}>
                <div className="app-icon">{app.name.trim().charAt(0).toUpperCase() || "A"}</div>
                <h3>{app.name}</h3>
                <p>Published by {app.publisherName}</p>
                <div className="app-meta">
                  <span className="chip success">Included</span>
                  {app.distributions
                    .filter((distribution) => distribution.status === "approved")
                    .map((distribution) => (
                      <span className="chip" key={`${distribution.browserFamily}-${distribution.channel}`}>
                        {distribution.browserFamily} · {distribution.channel}
                      </span>
                    ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No Apps are available yet</h3>
            <p>Approved pilot Apps will appear here as Publishers complete submission and review.</p>
          </div>
        )}

        <div className="actions">
          <Link className="secondary-button" href="/apps">View the full Apps catalog</Link>
        </div>
      </section>

      <section className="section" aria-labelledby="how-it-works-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">How it works</span>
            <h2 id="how-it-works-heading">From subscription to unlocked App</h2>
          </div>
          <p>Your human account and each extension session stay separate, with an explicit approval step before access is linked.</p>
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

      <section className="section">
        <div className="accent-panel">
          <span className="eyebrow">For invited Publishers</span>
          <h2>Bring your extension to Apps Pass.</h2>
          <p>
            Learn the integration contract, prepare your App manifest, and submit an invited extension for review.
            Publisher approval remains a deliberate private-pilot process.
          </p>
          <div className="actions">
            <Link className="primary-button" href="/submit">Submit an App</Link>
            <Link className="secondary-button" href="/docs">Read developer docs</Link>
          </div>
          <p>
            <strong>Pilot boundary:</strong> the $10/month Checkout uses Stripe test mode. Apps Pass does not send Publisher
            money; SERP pays Publishers externally and records evidence only after that payment is completed.
          </p>
        </div>
      </section>
    </main>
  );
}

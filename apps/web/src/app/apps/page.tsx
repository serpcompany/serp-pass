import type { Metadata } from "next";
import Link from "next/link";

import { readCatalogApps } from "@/apps/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apps",
  description: "Browse the approved browser extensions included with SERP Apps Pass.",
};

function displayLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AppsPage() {
  const catalogApps = await readCatalogApps();

  return (
    <main>
      <header className="page-hero">
        <span className="eyebrow">The Apps Pass catalog</span>
        <h1>Every approved extension is included.</h1>
        <p>
          One subscription unlocks every available App in the Pass. Browse the real Publisher extensions that have
          completed review, with no separate purchase for each App.
        </p>
        <div className="actions">
          <Link className="primary-button" href="/account">Get Apps Pass</Link>
          <Link className="secondary-button" href="/submit">Submit an App</Link>
        </div>
      </header>

      <section className="section" aria-labelledby="catalog-heading">
        <div className="section-heading">
          <span className="eyebrow">Included Apps</span>
          <h2 id="catalog-heading">Approved for the Pass</h2>
          <p>Availability is shown directly from the Apps Pass approval record.</p>
        </div>

        {catalogApps.length === 0 ? (
          <div className="empty-state">
            <h3>The catalog is being prepared.</h3>
            <p>No Apps are available yet. Publishers can submit an extension for review.</p>
            <Link className="secondary-button" href="/submit">Submit the first App</Link>
          </div>
        ) : (
          <div className="app-grid">
            {catalogApps.map((app) => (
              <article className="app-card" key={`${app.publisherName}:${app.name}`}>
                <div className="app-icon" aria-hidden="true">{app.name.slice(0, 1).toUpperCase()}</div>
                <h3>{app.name}</h3>
                <p>By {app.publisherName}</p>
                <div className="badge-row"><span className={`chip ${app.status === "approved" ? "success" : "warning"}`}>
                  {app.status === "approved" ? "Available" : "Suspended"}
                </span></div>

                <div>
                  <h4>Included features</h4>
                  {app.features.length === 0 ? (
                    <p>Feature details are coming soon.</p>
                  ) : (
                    <ul>
                      {app.features.map((feature) => <li key={feature}>{feature}</li>)}
                    </ul>
                  )}
                </div>

                <div>
                  <h4>Distributions</h4>
                  {app.distributions.length === 0 ? (
                    <p>No Distribution is currently available.</p>
                  ) : (
                    <div className="app-meta">
                      {app.distributions.map((distribution) => (
                        <span
                          className={`chip ${distribution.status === "approved" ? "success" : "warning"}`}
                          key={`${distribution.browserFamily}:${distribution.channel}`}
                        >
                          {displayLabel(distribution.browserFamily)} · {displayLabel(distribution.channel)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">One subscription</span>
          <h2>Use every available App.</h2>
          <p>Manage your Apps Pass access and billing from one account.</p>
        </div>
        <div className="actions">
          <Link className="primary-button" href="/account">View your account</Link>
        </div>
      </section>
    </main>
  );
}

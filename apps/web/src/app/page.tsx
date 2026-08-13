import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

const completed = [
  "Versioned extension submission contract",
  "Next.js / OpenNext Worker composition",
  "Environment-specific D1 and Drizzle path",
  "D1-backed private-pilot human sign-in",
  "Subscriber, Publisher, and Operator role enforcement",
  "Invited Publisher submission and real extension identity",
  "Local signed billing projection and paid-through state",
];

const upcoming = [
  "Isolated Stripe sandbox Checkout and real webhook adapter",
  "Authenticated extension activation",
  "Publisher Connect onboarding and settlement",
];

export default function Home() {
  const { env } = getCloudflareContext();

  return (
    <main>
      <header className="hero">
        <span className="eyebrow">Private-pilot MVP · {env.APP_ENV}</span>
        <h1>One subscription. Independently published extensions.</h1>
        <p>
          This is the production-shaped application being built from the completed extension-inclusion proof.
          It is not yet approved for real purchases or Publisher payouts.
        </p>
        <div className="actions">
          <a className="health" href="/account">Try human sign-in</a>
          <a className="secondary-link" href="/api/health">Inspect stack health</a>
        </div>
      </header>

      <section className="grid" aria-label="MVP delivery status">
        <article>
          <h2>Established</h2>
          <ul>{completed.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article>
          <h2>Required before the pilot works</h2>
          <ul>{upcoming.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </section>

      <aside>
        The account page now reads normalized paid-through authority from D1. Local signed fixtures prove projection
        behavior, but no Stripe account is connected and no Checkout, real webhook, entitlement, or settlement has occurred.
      </aside>
    </main>
  );
}

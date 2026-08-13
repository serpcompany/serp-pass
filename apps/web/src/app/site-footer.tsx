import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>SERP Apps Pass</strong>
        <p>Private pilot for one subscription across approved browser extensions.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/apps">Browse Apps</Link>
        <Link href="/submit">For developers</Link>
        <Link href="/docs">Integration docs</Link>
        <Link href="/account">Account</Link>
      </nav>
      <p className="footer-boundary">Test-mode product. Production and live money are not enabled.</p>
    </footer>
  );
}

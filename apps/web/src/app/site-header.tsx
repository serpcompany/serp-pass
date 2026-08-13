import Link from "next/link";

const links = [
  { href: "/apps", label: "Apps" },
  { href: "/submit", label: "Submit an App" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/" aria-label="SERP Apps Pass home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>SERP <strong>Apps Pass</strong></span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          <Link className="nav-account" href="/account">Account</Link>
        </nav>
      </div>
    </header>
  );
}

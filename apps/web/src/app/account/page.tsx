import Link from "next/link";

import { AuthPanel } from "./auth-panel";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <main>
      <Link className="back-link" href="/">← Apps Pass</Link>
      <AuthPanel />
      <aside>
        <strong>What this proves:</strong> Better Auth can create and read a human session through the same OpenNext Worker and local D1 database used by the MVP.
      </aside>
    </main>
  );
}

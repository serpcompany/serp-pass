import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./styles.css";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export const metadata: Metadata = {
  title: { default: "SERP Apps Pass", template: "%s · SERP Apps Pass" },
  description: "One subscription for approved SERP and Publisher Apps.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}

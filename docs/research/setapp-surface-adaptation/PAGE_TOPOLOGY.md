# Apps Pass surface topology inspired by Setapp

Status: implementation reference, not a Setapp clone

The Setapp references establish a useful information hierarchy: a promise-led home page, a browsable app catalog, and a developer acquisition page that explains the commercial value before technical integration. Apps Pass adapts that shape to the private pilot without copying Setapp branding, assets, metrics, pricing claims, or product breadth.

## Shared shell

1. Persistent header: SERP Apps Pass brand, Apps, Submit an App, Docs, Account.
2. Page-specific main content.
3. Compact footer: product boundary, environment label, primary routes.

## Routes

### `/`

1. Hero: one subscription for approved browser extensions.
2. Plain three-step Subscriber explanation.
3. Small preview of actual approved D1 Apps.
4. Separate Subscriber and Publisher calls to action.
5. Honest private-pilot boundary.

### `/apps`

1. Catalog heading and Pass explanation.
2. Server-rendered cards for approved or suspended Apps from D1.
3. Status, Publisher, supported browser, channel, and feature list.
4. Empty state if no approved Apps exist.

### `/submit`

1. Developer-facing promise and invitation-only boundary.
2. Visual explanation of the real five-step workflow.
3. Exact division of responsibility between SERP and Publisher.
4. Links to integration docs, invitation acceptance, and authenticated Publisher workspace.

### `/docs`

1. Beginner-oriented explanation of public IDs, SDK, `apppass.json`, and rebuild.
2. Minimal TypeScript and JSON examples using placeholder identities.
3. Submission/review/activation explanation.
4. Links to the authenticated Submission workspace.

## Interaction model

All four pages are primarily static and server-rendered. Navigation and calls to action are ordinary links. No carousel, tab system, fake search, or scroll-triggered interaction is required for this pilot slice.

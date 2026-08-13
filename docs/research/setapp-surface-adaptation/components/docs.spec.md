# Developer docs page specification

## Overview

- Target: `apps/web/src/app/docs/page.tsx`
- Source: the binding private-pilot integration standard
- Interaction model: readable static documentation and links

## Content

1. Explain that Publisher/App IDs are public labels, not secrets.
2. Show SDK installation, client creation, host permission, and entitlement check examples.
3. Show a complete placeholder `apppass.json`.
4. Explain rebuild, authenticated Submission, Operator review, and activation.
5. State what never goes into the extension: Stripe/platform secrets or user session cookies.

## Responsive behavior

- Desktop uses sticky table-of-contents-style sidebar and document body.
- Mobile stacks navigation above content; code scrolls horizontally.

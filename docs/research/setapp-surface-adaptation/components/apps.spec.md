# Apps catalog specification

## Overview

- Target: `apps/web/src/app/apps/page.tsx`
- Reference pattern: Setapp's catalog heading and card grid, reduced for a small real inventory
- Interaction model: static server-rendered catalog

## Data

- Read Apps, Publishers, and Distributions from D1.
- Parse the approved App `features_json` defensively.
- Group multiple Distributions under one App.
- Never expose runtime IDs, internal Submission IDs, or operational identifiers.

## States

- Approved App: Included in Pass.
- Suspended App: Temporarily unavailable.
- Empty catalog: explain that the private pilot has no approved Apps yet and link to `/submit`.

## Responsive behavior

- Desktop: two- or three-column grid.
- Mobile: one-column cards with badges wrapping naturally.

# Shared shell specification

## Overview

- Target: `apps/web/src/app/site-header.tsx`, `site-footer.tsx`, and `styles.css`
- Reference: Setapp's small global navigation, adapted to Apps Pass
- Interaction model: link navigation and responsive wrapping

## Structure

- Header contains brand mark/name, public navigation, and Account call to action.
- Footer contains a one-sentence pilot boundary and route links.
- Main content remains owned by each route.

## Visual direction

- Warm near-white background, near-black text, violet primary, mint accent.
- Rounded pill navigation and large-radius content panels.
- Brand uses a small four-cell mark; no external logo assets.
- Maximum shell width: 1180px.

## Responsive behavior

- Desktop: brand left, navigation right.
- Mobile: brand on first row; links wrap below with tap-sized targets.

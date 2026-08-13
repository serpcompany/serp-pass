# Example extension submissions

These directories are disposable proof fixtures, not products ready for the Chrome Web Store.

Each participating example contains:

- `apppass.json`: the Publisher submission imported by the Operator;
- `extension/manifest.base.json`: the minimum Chromium identity and popup declaration; and
- generated `dist/`: ignored build output assembled from `prototype/extension-shell/`.

`serp-reference` and `invited-publisher-reference` established the initial path. `post-freeze-reference` was deliberately created after the authority freeze and proved that a previously unknown App could enter without extension-specific authority changes.

Real Publishers would integrate `@serp-apps-pass/sdk` into their own extension code. They would not replace their extension with this repository's shared popup shell.

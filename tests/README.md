# Proof tests

Files ending in `.proof.test.ts` are executable evidence for the disposable local prototype. They are intentionally named as proof tests so they are not mistaken for a production QA program.

They validate:

- manifest validation, conflict handling, and schema-only startup;
- shared-SDK linking, App-scoped sessions, revocation, and suspension;
- generic discovery and build of additional example submissions; and
- a real unpacked-Chromium linking and entitlement path.

They do not validate production authentication, payment-provider behavior, deployed Cloudflare environments, Chrome Web Store releases, abuse resistance, load, observability, recovery, or production security.

Run the focused evidence suite with:

```sh
pnpm proof:test
```

The browser flow additionally requires the project-owned Chromium lifecycle and is run with:

```sh
pnpm proof:browser
```

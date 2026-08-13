# Authority freeze record

Freeze timestamp: `2026-08-13T16:11:02+09:00`

## Frozen authority revision

The authority used for the decisive extension-inclusion proof is frozen at:

```text
36db65e10d4969f5a1901b7e3c5fb71038a23405
```

## Frozen migration checksums

SHA-256 checksums calculated from the migration files at the frozen authority revision:

```text
6818aeb86b66d124c49ea1682cfe2a74a8a2d21974be36355711012e62d04b3b  migrations/0001_schema.sql
```

## Immutable scope

After this freeze record is committed, every existing repository file is immutable through completion of the decisive proof unless this freeze is abandoned and the acceptance sequence restarts from step 1. This includes, without limitation:

- `src/`
- `migrations/`
- `packages/`
- `extension-template/`
- `scripts/`
- `tests/`
- root package, workspace, lock, configuration, and documentation files
- both existing fixture directories under `examples/`
- this freeze record

The only allowed post-freeze implementation change is creation of one new, previously nonexistent direct child directory under `examples/`. That directory may contain only the decisive third fixture's assigned `apppass.json` and extension source files.

Generated ignored outputs and local runtime state do not count as implementation changes. No existing file may be edited to accommodate the third fixture.

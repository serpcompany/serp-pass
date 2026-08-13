# Apps Pass surface behavior reference

Status: intentionally reduced from the Setapp references

- The shared header remains in normal document flow and becomes a compact wrapped row on narrow screens.
- Buttons use a small lift and shadow change on hover; links retain visible focus outlines.
- App cards are real server-rendered links or articles. Suspended Apps remain visible but clearly labeled unavailable.
- The app catalog has no search or filters until enough real Apps exist to justify them.
- Developer calls to action never create a Publisher role. They lead to invitation acceptance, sign-in, or documentation.
- Code blocks scroll horizontally on small screens.
- Motion respects `prefers-reduced-motion`.
- Desktop uses generous rounded panels and a maximum content width; mobile collapses every multi-column grid to one column.

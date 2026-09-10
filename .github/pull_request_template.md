## What does this change?

<!-- A short summary. Link any related issue with "Closes #123". -->

## Why?

<!-- The problem this solves. -->

## How was it verified?

<!-- Commands run, cases checked. -->

- [ ] `pytest tests/ -v` passes
- [ ] `ruff check app scripts tests` passes
- [ ] `npm run lint` and `npx tsc --noEmit` pass
- [ ] `npm run build` succeeds

## Checklist

- [ ] New behaviour has tests; bug fixes have a regression test that fails without the fix
- [ ] No accuracy figure is hardcoded in markup — published numbers come from `metrics.json`
- [ ] If `FEATURE_COLUMNS` changed, the model was retrained and the UI controls still match
- [ ] API validation bounds remain a superset of the UI's bounds
- [ ] Docs updated if behaviour or setup changed

## Screenshots

<!-- For UI changes. -->

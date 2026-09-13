# PropIQ — Project Report

**Real estate market intelligence for King County, WA**

| | |
|---|---|
| **Author** | Md. Tahmidur Rahman Nafees |
| **Affiliation** | Department of Electrical and Computer Engineering, North South University |
| **Role** | Full-stack development and machine learning implementation |
| **Repository** | https://github.com/tahmidnafees619/propiq-insights-explorer-main |
| **LinkedIn** | https://www.linkedin.com/in/md-tahmidur-rahman-nafees-04a6a3227/ |
| **Status** | v1.1.0 — feature complete · 116 backend tests passing · all 9 endpoints verified |
| **Last verified** | 2026-09-14 |

**Companion documents:** [Model report](MODEL_REPORT.md) · [API reference](API.md) · [Roadmap](ROADMAP.md)

---

## 1. Executive summary

PropIQ prices residential property in King County, Washington from 21,599 real
sale records, and explains every number it produces.

Most home-value estimators return a price and nothing else. The premise here is
that an unexplained estimate is close to worthless to the person who has to act
on it, so every prediction ships with four things:

1. **A price** — gradient-boosted estimate from 16 property attributes
2. **A calibrated range** — a 90% prediction interval derived from the model's
   own held-out residuals, not a fixed percentage
3. **A breakdown** — the estimate decomposed by ablation into size, rooms,
   quality, location and waterfront
4. **Real comparables** — the five most similar sales nearby, with the estimate
   plotted against what those homes actually sold for

The deployed model scores **R² 0.904** with **MAE $64,704** and a **median error
of 8.3%** on a held-out split, measured on actual sale prices rather than the
log-transformed training target.

**What distinguishes this project is not the model — it is the engineering
discipline and the honesty around it.** Gradient boosting on the King County
dataset is well-trodden ground. Calibrated intervals whose empirical coverage
is measured and published, explainability that reconciles arithmetically,
figures that structurally cannot drift from the deployed artifact, and a test
suite that encodes past bugs as regressions are considerably less common.

---

## 2. Problem statement

Residential pricing is opaque. Buyers, sellers and agents make six-figure
decisions on rough comparables and instinct. Automated valuation models exist,
but the mainstream ones are black boxes: they return a number and a range with
no account of where either came from.

That opacity has a practical cost. At a listing appointment, an agent has to
justify a price to a seller who believes their home is worth more. *"The
algorithm says $430,000"* is not an argument. *"It's $430,000 because location
contributes this, build grade contributes that, and five comparable homes within
half a mile sold between $415,000 and $450,000"* is.

PropIQ targets that gap: a valuation that can be **defended**, not merely quoted.

---

## 3. Dataset

| Property | Value |
|---|---|
| Source | King County House Sales (published by King County, WA) |
| Raw records | 21,613 |
| After cleaning | 21,599 |
| Period | May 2014 – May 2015 |
| Geography | King County, WA (70 ZIP codes) |
| Target | Sale price ($78,000 – $7,700,000) |

**Cleaning:** dropped null and non-positive prices, de-duplicated on `(id, date)`
keeping the latest, and excluded a known data-entry error (a 1,620 sqft home
recorded with 33 bedrooms) by bounding bedrooms to 1–15.

**Derived fields:** `year_sold`, `month_sold`, `house_age`, `was_renovated`.

**A stated limitation.** This data is from 2014–15. The application is a
demonstration of method, not a current-market pricing service, and the interface
says so wherever it matters — comparable sales carry their sale dates, and
predictions for homes built after 2015 are flagged as extrapolations.

---

## 4. Modelling

Full treatment in the **[model report](MODEL_REPORT.md)**. Summary:

| Model | R² ($) | R² (log) | MAE | Median APE |
|---|---|---|---|---|
| **Gradient Boosting** ⭐ | **0.904** | 0.907 | **$64,704** | **8.3%** |
| Random Forest | 0.885 | 0.896 | $69,200 | 8.7% |
| Ridge | 0.469 | 0.768 | $115,701 | 15.8% |
| Linear Regression | 0.469 | 0.768 | $115,701 | 15.8% |

**Metrics are reported in dollar space, not log space.** Ridge scores a
respectable 0.768 on the log target and collapses to 0.469 in dollars — a model
judged only on its training target would look usable while being off by $116k on
the average home. Reporting the inflated figure would be the single easiest way
to overstate this project, so the training script computes both and the
interface publishes the dollar-space number.

Top drivers: **latitude 31%**, **construction grade 30%**, **living area 23%**.

### What the analysis for this report found

The deployed artifact was re-scored from scratch while writing this document.
It reproduces `metrics.json` exactly (R² 0.9036, MAE $64,704) — no drift. It
also surfaced three things the stored metrics do not show:

- **Interval coverage is 91.3% against a nominal 90%** — slightly conservative.
  The empirical quantiles that would land it on exactly 90.0% are already
  computed and stored, just unused. ([Roadmap item 1](ROADMAP.md).)
- **The model regresses to the mean, systematically.** It overprices the
  cheapest decile by ~$24k and underprices the top decile by ~$102k. Expected
  for a squared-error learner on a skewed target, but at the top of the market
  that bias is a fifth of the MAE in that band.
- **Waterfront is the worst segment by a distance** — 21% median error on 33
  held-out sales. Not fixable by tuning; 33 examples cannot teach a ~213%
  premium that varies by *which* water. This is what justifies hard-filtering
  comparables on waterfront (§4.5, §8.2).

### 4.4 Explainability

The value breakdown is computed by **ablation**: price a typical King County
home, then substitute the user's values one feature group at a time and record
each delta.

Gradient boosting is not additive, so those deltas do not sum exactly to the
final price. The remainder is reported openly as *"Combined effects"* rather
than being silently distributed across the other rows. The column reconciles to
the estimate, and a test enforces that.

### 4.5 Comparable sales

Bounding-box prefilter in SQL, then exact haversine distance in Python. Ranking
weights: distance 40%, size 30%, grade 20%, room count 10%. The search widens
only when it must — 2 mi, then 5 mi, then 15 mi.

**Waterfront is a hard filter, never a scored dimension.** It carries a ~213%
premium in this dataset; mixing across it makes the range meaningless. This was
discovered in testing (§8.2).

---

## 5. System architecture

```
┌───────────────────────────┐         ┌───────────────────────────┐
│  React 19 + TanStack      │  HTTP   │  FastAPI                  │
│  Router · Query · Recharts│ ──────► │  routers → services → ORM │
└───────────────────────────┘  JSON   └────────────┬──────────────┘
         │                                         │
         │ falls back to                           ├──► SQLite (SQLAlchemy 2.0)
         ▼                                         │
   bundled demo dataset                            └──► scikit-learn artifacts
   (never a blank screen)                               model · scaler · metrics
```

### 5.1 Layering

`router` → `service` → `model`, enforced by convention and reviewable in code:

- **Routers** own the HTTP contract — paths, query parameters, status codes,
  response schemas. They never touch the ORM.
- **Services** own business logic. They accept a `Session` and plain arguments,
  never a `Request`, which is what makes them testable without a client.
- **Models** own persistence only.

### 5.2 Operational concerns

| Concern | Implementation |
|---|---|
| Error handling | One JSON envelope for every failure, with field-level detail |
| Traceability | Per-request correlation ID, echoed in `X-Request-ID` and embedded in error payloads |
| Logging | Structured JSON in production, human-readable in debug |
| Configuration | Environment-driven; relative paths resolve against the backend root |
| Validation | Pydantic bounds plus cross-field geometry checks |
| Degradation | Serves a curated dataset when the database is empty, always labelled |

### 5.3 The demo fallback

The application renders completely on a fresh clone with no database and no
backend running. This is two-sided — the API serves a bundled dataset when its
table is empty, and the frontend serves its own copy when the API is
unreachable.

The dataset is deterministic (fixed-seed PRNG), so figures are identical on
every machine and every run. Its rows are anchored to the same aggregates the
charts display, and `tests/test_demo_data.py` fails if the two drift apart.

**Model accuracy is never sourced from the fallback.** It always comes from the
deployed model's own report.

---

## 6. Interface

Four routes: **Dashboard** (market aggregates and KPIs), **Predictor**
(estimate, interval, breakdown, comparables, live floor plan), **Market
Insights** (feature importance, price choropleth, seasonality), and **About /
Model Report** (published accuracy, methodology).

### 6.1 Design system

The palette is built from drafting materials rather than assembled from a UI
kit, and every ramp is derived in HSL so hue stays constant while saturation
falls off as lightness rises.

| Role | Colour | Rationale |
|---|---|---|
| Neutrals | Hue 202, cyan-navy | Tailwind slate sits near 215 with a purple lean — the most recognisable default-palette tell in a dark UI |
| Ink | **Cyanotype** `#2F99DA` | The pigment of an actual blueprint. Hue 203 against blue-500's 217; saturation 70 against its 91 |
| Accent | **Aged brass** `#D0A74E` | Surveying instruments, not a warning triangle. Reserved for the primary action and nothing else |
| Positive | **Verdigris** `#3DAE91` | Weathered copper |
| Negative | **Iron oxide** `#D5533F` | |
| Data | 9-step sequential ramp | Kept clear of the accent, so a chart series is never mistaken for something interactive |

Two rules the components follow:

- **One accent, rationed.** Brass appears on exactly one control in the app.
  That is what makes it read as emphasis rather than decoration.
- **Quantities never borrow the UI palette.** Charts use the sequential ramp;
  interactive elements use ink.

Every text pairing is checked against WCAG. Contrast for the shipped palette
runs from 6.0:1 (negative text on a card) to 17.2:1 (primary text on the page
ground) — all pass AA, most exceed AAA.

### 6.2 Motion vocabulary

All timing comes from `src/lib/motion.ts`: five durations, a small set of easing
curves. Coherence comes from a shared vocabulary rather than from animating more
things — six improvised easing curves is what makes an interface feel
scaffolded.

`prefers-reduced-motion` is honoured centrally through `useMotionEnabled()`,
which also normalises Framer's tri-state (`null` before the media query
resolves) so honouring the preference is the default rather than something each
component must remember to opt into.

---

## 7. UI/UX problems and how they were solved

This section is the frontend counterpart to §8. Each item is a problem that
appeared in a built interface, not a hypothetical.

### 7.1 Controls that did nothing

**Problem.** The predictor presented bedrooms and bathrooms as primary controls.
Neither was in the trained feature set. A 1-bedroom and a 10-bedroom home of
identical size returned the same price — the interface was lying through an
input.

**Solution.** Added both to the feature contract and retrained. R² moved 0.860 →
0.904 and MAE $79,553 → $64,704, so the honest interface was also the more
accurate one. A CI assertion now fails the build if either leaves the feature
set, and the stated principle is **every control must matter: if the UI exposes
an input, the model uses it.**

This is also why `bedrooms` stays in the model at 0.11% importance — dropping it
for a rounding error of accuracy would restore the original lie.

### 7.2 A form that could produce an unreachable error

**Problem.** The API validates that `sqft_above + sqft_basement ≤ sqft_living`.
The form let a user set all three independently, so a valid-looking
configuration could be rejected on submit with a geometry error they had no way
to interpret.

**Solution.** The form derives above-ground area from living area and basement
rather than collecting it. The error is now unreachable through the UI and
exists only for direct API callers — validation stayed strict, but the interface
stopped being able to violate it. Fixing the constraint *in the input model*
rather than adding an error message is the general principle.

### 7.3 A button that silently did nothing on failure

**Problem.** The predictor never read the mutation's error state. A rejected
request produced no feedback whatsoever — the user pressed the button and the
page sat there.

**Solution.** Failures render inline, with field-level messages mapped from the
API's `details` array back onto the fields that produced them. This is why the
error envelope carries a structured `field` rather than a prose message: the
envelope was designed for the form that consumes it.

### 7.4 A rejected request where a caveat belonged

**Problem.** The form allowed years up to the present; the API capped `yr_built`
at 2015. Entering a realistic recent build year returned a 422. The user's input
was reasonable; the model's training range simply did not cover it.

**Solution.** The API now prices post-2015 homes and returns
`extrapolated: true` with an explanatory note, and the UI flags the estimate and
drops the confidence label to *low*. **A limitation stated is more useful than a
request refused** — the user gets a number *and* the reason to discount it.

### 7.5 A map with no map

**Problem.** The insights page shipped a pulsing-dot placeholder standing in for
geography. It conveyed nothing. The obvious fix — a mapping library plus a tile
provider — means a dependency, an API key, a network round trip per tile, and a
third-party request on every page view.

**Solution.** A real choropleth of all 70 ZIP codes with no mapping library at
all. Census TIGER/Line ZCTA boundaries were filtered to the ZIPs in the data and
simplified with an iterative Douglas-Peucker implementation (the recursive form
overflows the stack on long coastlines), then truncated to ~11 m precision:
**125 KB raw, 26.8 KB gzipped**, code-split into the route that uses it. Web
Mercator projection is roughly six lines in-component. Once the page loads, the
map needs no network at all.

**Shading uses quantile bins, not equal intervals.** Prices span 8× and are
heavily right-skewed; equal intervals would render 68 of the 70 ZIPs in the same
shade and show nothing. This is the difference between a map that is present and
a map that is informative.

### 7.6 A floor plan that was not a floor plan

Three iterations, documented because the first two failures were instructive.

**Attempt 1 — treemap.** Subdivided the footprint by area. Tiled perfectly and
looked nothing like a home: bathrooms between bedrooms, no circulation, nothing
opening off anything. *A layout algorithm that satisfies the numbers can still
be nonsense to a human.*

**Attempt 2 — corridor template.** Fixed the plausibility problem and replaced
it with rigidity: one plan that only ever grew more columns. Every property drew
the same house at a different scale.

**Attempt 3 — a rules engine.** Plans are generated from residential design
rules: the room programme grows with floor area (a 6,000 sf house gets a dining
room, a study and a utility, not six narrow bedrooms); circulation changes with
size (no hall in a small flat, a corridor in a mid-size home, a double-loaded
spine in a large one); and bathrooms are **allocated** rather than counted — a
half bath is a guest WC in the public zone, ensuites attach to bedrooms and draw
smaller than a shared family bathroom, except above grade 10 where the primary
suite becomes the largest bathroom in the house, as it does in life.

Arrangement is chosen by a seed derived from the property, so the same inputs
always draw the same plan and a different property genuinely re-plans rather
than re-scaling. A Shuffle control offers alternative arrangements of the same
brief. All **10,368 input/shuffle combinations** are checked against layout
invariants: no overlaps, everything inside the footprint, every habitable room
on an exterior wall for a window.

The plan redraws live as the form changes, which is why `PropertyForm` emits
`onDraftChange` on every edit rather than only on submit.

### 7.7 SVG animation traps

Three concrete failures worth recording, all in `FloorPlanSchematic`:

- **Animating a `<rect>`'s own `x`/`y`.** On SVG children Framer treats `x`/`y`
  as transforms, which silently fights the attributes of the same name. Rooms
  are positioned by animating a wrapping `<g>` instead.
- **Morphing between arbitrary path strings.** Doors, windows and fixtures
  change *shape*, not just position, and interpolating two arbitrary `d`
  attributes produces garbage far more often than animation. They cross-fade.
- **Non-deterministic geometry.** Any randomness in layout means the server and
  client render different markup and React discards the server tree. Geometry
  comes from a pure function seeded by the property.

### 7.8 A counting KPI that re-rendered sixty times a second

**Problem.** The obvious implementation of an animated number sets React state
every frame, re-rendering the whole card at 60fps.

**Solution.** `AnimatedNumber` renders once. A spring drives the intermediate
values and writes them straight to the DOM node, so a counting KPI costs zero
React renders.

It also has to survive SSR: **the final value is what renders on the server**, so
the correct figure is in the markup before any script runs, search engines see
it, and the layout never shifts. The client zeroes the node in a layout effect —
*before* first paint rather than during it — so there is no visible snap from the
final value back to zero.

### 7.9 A full-viewport animated background without the jank

The blueprint background is the easiest thing in an app to make janky. Five
constraints keep it cheap:

- Only `transform` and `opacity` animate — everything stays on the compositor.
- Pointer tracking writes to motion values, never to React state, so moving the
  mouse never triggers a render.
- The drafting lamp is a second copy of the same geometry at higher ink,
  revealed through a radial mask pinned to the pointer. Both copies share the
  same motion values; independent drift would show as doubled lines.
- The lit copy renders as plain paths, not motion components — it is revealed
  wholesale by the mask, so there is no reason to pay for seventy more
  animators.
- The layer is mounted **outside the route tree**, so navigating never re-drafts
  the drawing.

### 7.10 The title sequence, and the three problems it had to solve

The newest work: a drafting-table title sheet that draws the PropIQ wordmark and
hands off to the app on scroll.

**Problem A — an intro that gets in the way.** Any splash screen is a thing
standing between someone and what they came for. An earlier version played an
abbreviated 0.6s variant on return visits; it was still a sheet in the way.

*Solution:* three conditions must all hold — the route is the dashboard (it is
the dashboard's cover page, not the app's; reaching Predictor should never mean
scrolling past a title), it has not been shown this session, and the visitor has
not requested reduced motion. Return visits go straight to the dashboard.
"Shown" is recorded the moment the sheet appears, not when it finishes, so
navigating away mid-sequence also counts. A `?intro=1` override exists so a demo
can be recorded from a cold start without clearing storage.

**Problem B — an intro that costs page speed.** A full-screen overlay that
blocks the app is a Largest Contentful Paint disaster.

*Solution:* the sheet is a **spacer with a sticky stage**, and the dashboard
sits beneath it in normal document flow. The content is in the document whether
or not the sequence runs, so the intro costs no LCP. Only `transform` and
`opacity` animate; the ink uses `pathLength`, which Framer compiles to
stroke-dash offsets on the compositor.

**Problem C — a logo that flashes unstyled.** A web-font wordmark on the most
important frame of the site risks FOUT/FOIT on the first paint a visitor ever
sees.

*Solution:* **the wordmark is geometry, not type.** Monoline letterforms —
single-stroke skeletons of the kind a pen plotter produces, on a 100-unit cap
height — with no font dependency at all. The choice is also what makes the
animation work: `pathLength` animates a skeleton convincingly, where running it
on a filled outline gives a wobbling contour instead of handwriting. And because
every curve is constructed from a circle and a straight, the construction
guides a letterer actually sets out can be drawn first.

**The handoff.** On scroll the house is lowered out of frame first — down and
forward, with a contact shadow spreading to meet it — then the sheet furniture
retracts and the wordmark dismantles letter by letter, each letter dipping,
loading and swinging up toward the corner where the navbar sits. The house going
down while the letters go up is what gives the exit depth.

The navbar's own logo fades in only once the last letter is gone. There is
deliberately **no shared-element morph** between them: a drawn stroke mark and
typeset text do not share a shape to morph between, and forcing one would look
like a bug. `Navbar` subscribes to `introActive` purely to stay out of the way.

`prefers-reduced-motion` never reaches the sequence at all — the provider
resolves to off and the app renders alone.

### 7.11 Never a blank screen, never a silent lie

**Problem.** A dashboard whose backend is down is an empty page. A dashboard
that fills itself with fake data is worse.

**Solution.** Both halves. Every hook falls back to the bundled showcase dataset
if the API is unreachable, and requests time out at 10 s — a hung fetch would
otherwise leave a chart spinning forever. But the fallback is **always labelled
with a visible badge**, endpoints report a `source` field, and model accuracy is
never sourced from demo data.

### 7.12 Wording that only reads correctly half the time

Small, but representative. The confidence gauge originally said *"Top X%"*.
Below the midpoint that phrasing is confusing at best. It now reads *"More
expensive than 62% of King County homes"* above the median and *"More affordable
than 38%"* below it.

---

## 8. Engineering practice

### 8.1 Testing

**116 backend tests**, asserting on values rather than key existence.
`assert body["total"] == 6` catches regressions that `assert "total" in body`
never will.

| Suite | Tests | Coverage |
|---|---|---|
| `test_properties.py` | 24 | Filtering, sorting, pagination, demo fallback |
| `test_prediction.py` | 23 | Contract, monotonicity, validation, importances, metrics |
| `test_comparables.py` | 17 | Selection quality, similarity ranking, waterfront matching |
| `test_demo_data.py` | 16 | Determinism, internal consistency |
| `test_stats.py` | 15 | Aggregates against hand-computed values |
| `test_health.py` | 11 | Readiness, error envelope, request IDs |
| `test_zipcode_stats.py` | 10 | Choropleth contract, median arithmetic, ZIP key format |

Tests run against an in-memory database and never touch local data. CI runs
lint, type check, tests and build on every push, plus a guard asserting the
feature contract stays consistent between training and inference.

**The gap:** there are no frontend tests. The heaviest pure logic in the repo —
the floor-plan rules engine, the Mercator projection, the intro state machine —
has no automated coverage, and the floor-plan invariants are *already written as
assertions* that nothing runs. This is [roadmap item 3](ROADMAP.md).

### 8.2 Three bugs worth reporting

**Inert model inputs.** Covered in §7.1 — the predictor exposed bedrooms and
bathrooms as primary controls while neither was in the trained feature set.
Fixing the honesty problem improved R² from 0.860 to 0.904.

**Comparables crossing the waterfront line.** A waterfront home in Medina priced
at $3.53M against a comparable range of $1.95M–$2.68M — apparently a model
failure. Inspection showed every comparable returned was *inland*. Waterfront
was being scored as one dimension among several rather than filtered on.

| | Comparable range | Estimate $3,526,571 |
|---|---|---|
| Before | $1.95M – $2.68M | outside |
| After | $2.57M – $3.65M | inside |

The nearest waterfront comparable, 1.0 mi away, had sold for $3,640,900 — within
3% of the estimate. **The model was right; the comparison set was built from the
wrong houses.** The segment analysis in the [model report](MODEL_REPORT.md#by-segment)
later confirmed why this matters so much: waterfront is the model's weakest
segment at 21% median error, so it is exactly where the comparison set has to
carry the reader's judgement.

**A lint config that walked 200,000 files.** Found during this review. The
ESLint ignore list covered `dist` and `.output` but not the Python virtualenvs
living in the repo, so `eslint .` traversed every file in
`.venv-1/Lib/site-packages` before linting anything — over ten minutes, which is
long enough that the command reads as hung and stops being run. Adding the
ignores took it to **13 seconds**. A check nobody runs provides no safety.

The same pass added a `.gitattributes` (`* text=auto eol=lf`), which the repo
had been missing — on a Windows checkout, Prettier's LF expectation and Git's
CRLF conversion disagree, and that disagreement surfaces as dozens of
`Delete ␍` errors on files nobody meaningfully touched.

### 8.3 Published figures cannot drift

Every accuracy number the interface displays is read from `models/metrics.json`,
written by the training script and exposed through `/api/model/metrics`. Nothing
is typed into markup.

This matters because an earlier version advertised R² 0.883 and MAE $42,100
while the deployed model actually scored 0.860 and $79,553. The case study had
drifted from the artifact. It structurally cannot now — and the independent
re-scoring performed for this report confirms it: stored and recomputed figures
match to four decimal places.

---

## 9. Verification

Performed 2026-09-14 against a running instance backed by the full seeded
database.

| Check | Result |
|---|---|
| Backend tests | **116 passed** in 16.6 s |
| Backend lint (Ruff) | **All checks passed** |
| Frontend type check (`tsc --noEmit`) | **Clean** |
| Frontend lint (ESLint) | **0 errors**, 7 warnings (shadcn/ui `react-refresh` boilerplate) |
| Production build | **Succeeded** in 6.9 s |
| API endpoints | **9/9 verified** — see [API reference](API.md#2-verification-log) |
| Error paths | 422 validation, 422 cross-field geometry, 404 domain, 404 route, extrapolation flag — all correct |
| Model reproduction | R² 0.9036 and MAE $64,704 recomputed from the artifact, matching `metrics.json` exactly |

### Bundle sizes (gzipped)

| Asset | Raw | Gzipped |
|---|---|---|
| Main bundle | 546 KB | 176 KB |
| Charts (Recharts) | 376 KB | 104 KB |
| Insights route *(incl. all boundary geometry)* | 136 KB | 32.7 KB |
| Stylesheet | 84 KB | 14.5 KB |
| Predictor route | 46 KB | 14.0 KB |
| ZCTA boundary data | 125 KB | 26.8 KB |

Slowest API endpoint under 100 ms on SQLite with no cache.

---

## 10. Project structure

```
propiq/
├── README.md · CHANGELOG.md · LICENSE · SECURITY.md
├── CONTRIBUTING.md · CODE_OF_CONDUCT.md
├── Makefile                          # one entry point per task; `make check` = CI
├── docker-compose.yml · Dockerfile
├── .gitattributes · .editorconfig · eslint.config.js · .prettierrc
│
├── docs/
│   ├── PROJECT_REPORT.md             # this document
│   ├── MODEL_REPORT.md               # ML analysis, residuals, calibration
│   ├── API.md                        # endpoint reference + verification log
│   └── ROADMAP.md                    # prioritised future work
│
├── src/                              # React frontend
│   ├── routes/                       # File-based: dashboard, predictor, insights, about
│   ├── components/
│   │   ├── background/               # Blueprint background + plan geometry
│   │   ├── charts/                   # Recharts visualisations + choropleth
│   │   ├── dashboard/                # KPI cards, property table
│   │   ├── intro/                    # Title sheet: provider, sequence, geometry
│   │   ├── layout/                   # Navbar, sidebar, mobile tab bar, page wrapper
│   │   ├── motion/                   # Motion primitives + reduced-motion hook
│   │   ├── predictor/                # Form, result, breakdown, gauge, floor plan, comps
│   │   ├── shared/                   # Empty/error/loading states, data-source badge
│   │   └── ui/                       # shadcn/ui primitives
│   ├── hooks/                        # One hook per endpoint, each with demo fallback
│   ├── lib/
│   │   ├── api.ts                    # Typed client, error normalisation, timeouts
│   │   ├── floorplan.ts              # Floor-plan rules engine
│   │   ├── motion.ts                 # Motion design tokens
│   │   └── demo-data.ts              # Bundled showcase dataset
│   ├── data/                         # Simplified Census ZCTA boundaries
│   ├── types/                        # Shared contracts, mirroring the API schemas
│   └── styles.css                    # 83 design tokens
│
├── propiq-backend/
│   ├── app/
│   │   ├── main.py                   # App factory, middleware, lifespan
│   │   ├── config.py                 # Env-driven settings
│   │   ├── database.py               # Engine, session, schema bootstrap
│   │   ├── exceptions.py             # Domain errors + JSON error envelope
│   │   ├── middleware.py             # Request IDs, timing, access logs
│   │   ├── logging_config.py         # JSON logs in production
│   │   ├── models/                   # SQLAlchemy ORM
│   │   ├── schemas/                  # Pydantic request/response contracts
│   │   ├── routers/                  # health · prediction · properties · stats
│   │   └── services/                 # ml · property · stats · comps · demo_data
│   ├── scripts/
│   │   ├── train_model.py            # Trains, compares, calibrates, persists
│   │   └── seed_db.py                # Loads the CSV into SQLite
│   ├── tests/                        # 116 tests
│   └── models/                       # model.pkl · scaler.pkl · metrics.json
│
└── .github/workflows/ci.yml          # Lint, typecheck, test, build, contract guard
```

---

## 11. Technology

**Frontend** — React 19 · TypeScript · TanStack Start/Router/Query · Tailwind
CSS 4 · Recharts · Framer Motion · Vite 7

**Backend** — Python 3.11 · FastAPI · Pydantic v2 · SQLAlchemy 2.0 ·
scikit-learn · pandas · NumPy

**Tooling** — pytest · Ruff · mypy · ESLint · Prettier · Docker · GitHub Actions

---

## 12. Results

| Metric | Value |
|---|---|
| Model R² (dollars) | 0.904 |
| Mean absolute error | $64,704 |
| Median absolute error | 8.3% |
| Within ±10% / ±20% | 57% / 83% |
| Interval coverage | **91.3% measured** against a nominal 90% |
| Records served | 21,599 |
| Backend tests | 116 passing |
| API endpoints | 9, all verified |
| Slowest endpoint | < 100 ms |
| Choropleth payload | 26.8 KB gzipped, no map library |
| Frontend lint / typecheck / build | Clean |

---

## 13. Limitations and further work

**Known limitations**

- Data is from 2014–15; this demonstrates method, not current market pricing
- Random rather than chronological split — measures interpolation, not forecasting
- Single county; latitude's 31% importance is a fact about *this* geography
- The model regresses to the mean: ~$102k low on the top decile
- Waterfront and very high grade are thinly covered (33 and 107 held-out sales)
- No frontend tests
- ~25 component files still carry literal hex instead of design tokens
- No authentication — intended to run locally or behind access controls
- SQLite by default, appropriate for single-instance read-heavy use

**Prioritised further work** is in the **[roadmap](ROADMAP.md)**. The four
highest-value items:

1. **Empirical-quantile prediction intervals** — a few lines; already-computed
   numbers move coverage from 91.3% to exactly 90% and make the band asymmetric
   in the direction the residuals actually are
2. **Finish the design-token migration** — mechanical, and unblocks a light theme
3. **Frontend tests** — converts existing floor-plan invariants into a safety net
4. **Renovation ROI** — the ablation engine already computes it; mostly interface

---

## 14. Running it

```bash
git clone https://github.com/tahmidnafees619/propiq-insights-explorer-main.git
cd propiq-insights-explorer-main

# Backend
cd propiq-backend
python -m venv venv && source venv/bin/activate   # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (second terminal, from the repository root)
npm install && npm run dev
```

The application runs immediately with its bundled dataset. To load the full
21,599 records, place `kc_house_data.csv` in `propiq-backend/data/raw/` and run
`python scripts/seed_db.py`.

Docker: `docker compose up --build` · everything CI runs: `make check`

---

## 15. Author

**Md. Tahmidur Rahman Nafees**
Department of Electrical and Computer Engineering, North South University

Full-stack development and machine learning implementation — the data pipeline,
model training and calibration, explainability, the FastAPI service, and the
React dashboard.

[LinkedIn](https://www.linkedin.com/in/md-tahmidur-rahman-nafees-04a6a3227/) ·
[GitHub](https://github.com/tahmidnafees619/propiq-insights-explorer-main)

---

*Built on the King County House Sales dataset. ZIP boundaries from US Census
TIGER/Line (public domain). Licensed MIT.*

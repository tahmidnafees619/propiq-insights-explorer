# Model Report

**PropIQ price estimator — King County, WA**

| | |
|---|---|
| **Artifact** | `propiq-backend/models/model.pkl` |
| **Estimator** | `GradientBoostingRegressor` (scikit-learn) |
| **Trained** | 2026-09-10 |
| **Target** | `log1p(price)` |
| **Training rows** | 17,279 · **held out** 4,320 |
| **Report source** | `models/metrics.json`, written by `scripts/train_model.py` |

Every figure below was **recomputed from the deployed artifact** while writing this
document, not copied from the stored report. The reproduction is exact:

```
r2($)   stored 0.9036   recomputed 0.9036
MAE     stored $64,704  recomputed $64,704
```

That is the point of the pipeline — the published number and the shipped model
cannot disagree.

---

## 1. Data and preparation

| Step | Rows |
|---|---|
| Raw `kc_house_data.csv` | 21,613 |
| Drop null / non-positive price | — |
| Drop rows with any null feature | — |
| Bound bedrooms to 1–15 (removes the known 33-bedroom typo) | — |
| De-duplicate on `(id, date)`, keep latest | — |
| **Usable** | **21,599** |

Price is heavily right-skewed ($78k–$7.7M), so the model learns `log1p(price)`
and inverts with `expm1` at inference. Features are standardised with a
`StandardScaler` fitted on the training split only — the scaler is persisted
alongside the model and validated against it at startup.

---

## 2. Model selection

Four candidates, identical 80/20 split, `random_state=42`. Selection is on
held-out **RMSE in log space**; reporting is in **dollars**.

| Model | R² ($) | R² (log) | MAE | RMSE | Median APE | ±10% | ±20% |
|---|---|---|---|---|---|---|---|
| **GradientBoosting** ⭐ | **0.9036** | 0.9070 | **$64,704** | $114,277 | **8.35%** | 57.1% | 83.2% |
| RandomForest | 0.8851 | 0.8957 | $69,200 | $124,749 | 8.72% | 56.1% | 81.9% |
| Ridge | 0.4685 | 0.7677 | $115,701 | $268,345 | 15.79% | 33.3% | 61.1% |
| LinearRegression | 0.4686 | 0.7677 | $115,701 | $268,341 | 15.79% | 33.3% | 61.1% |

**The linear gap is the most instructive row in this table.** Ridge scores a
respectable 0.768 in log space and collapses to 0.469 in dollars. A model
judged only on its training target would look usable; the same model judged on
what a user actually sees is off by $116k on the average home. This is the
single easiest way to overstate a regression project, and it is why the
training script computes both and the interface publishes the dollar figure.

The gap also tells you the price surface is genuinely non-linear — location
interacts with size and grade in ways an additive model cannot express. That is
the justification for boosting here, rather than "boosting scores higher".

---

## 3. Feature contract

Sixteen features, in binding order:

`sqft_living` · `sqft_lot` · `bedrooms` · `bathrooms` · `floors` · `waterfront` ·
`view` · `condition` · `grade` · `sqft_above` · `sqft_basement` · `yr_built` ·
`lat` · `long` · `sqft_living15` · `sqft_lot15`

The list is pickled with the model, re-indexed against on every request, and
checked against the scaler's `n_features_in_` at load. A mismatch **refuses to
start** rather than scaling the wrong columns — silently misaligned features
produce confidently wrong prices, which is worse than an outage. CI asserts the
same contract holds between `train_model.py` and `ml_service.py` on every push.

### Importance

| Feature | Importance |
|---|---|
| `lat` | 30.95% |
| `grade` | 30.13% |
| `sqft_living` | 22.64% |
| `long` | 4.71% |
| `sqft_living15` | 2.81% |
| `yr_built` | 1.91% |
| everything else | < 1.6% each |

Latitude alone outweighs every physical attribute except build grade. In King
County that is geographically literal: the north–south axis runs from Bellevue
and Medina down through the southern suburbs, and it is close to a price axis.

**`bedrooms` (0.11%) and `floors` (0.06%) are near the bottom — and they stay
in the model anyway.** Both are primary controls in the predictor UI. A control
the model ignores is a lie told through an input, and dropping them for a
rounding error of accuracy would be the wrong trade. Keeping them is also not
free of value: adding rooms to the feature set is what moved R² from 0.860 to
0.904 in the first place, because `bathrooms` (0.42%) carries more than
`bedrooms` does.

---

## 4. Calibrated prediction intervals

The interval is not a fixed percentage. It comes from the standard deviation of
held-out residuals in log space (σ = 0.16236), applied as a two-sided normal
band and inverted into price:

```
low  = expm1(log_pred − 1.645·σ)
high = expm1(log_pred + 1.645·σ)
```

### Does the nominal 90% hold?

Measured against the held-out set:

| Interval construction | Nominal | **Empirical coverage** |
|---|---|---|
| Normal, `z·σ` — **what ships** | 90% | **91.3%** |
| Empirical residual quantiles `q05 … q95` | 90% | **90.0%** |

The shipped interval is **slightly conservative** — it covers 91.3% of homes
where it claims 90%. Erring wide is the right direction for a valuation tool,
but it is erring by accident rather than by design.

The quantiles that would land it exactly on 90% are **already computed and
already stored** in `metrics.json` (`q05 = −0.2468`, `q95 = +0.2611`) — and they
are asymmetric, which the normal band cannot represent. Switching the bounds to
read those two numbers is a change of a few lines in `ml_service.py`. It is the
highest value-per-line improvement left in the model layer, and it is
[first on the roadmap](ROADMAP.md).

The residuals support that: skew is negligible (−0.074) but **kurtosis is
+4.18** — distinctly heavier-tailed than a normal. A Gaussian band is
mis-specified precisely where it matters, in the tails that produce the
embarrassing misses.

### Interval width

The mean interval spans **54% of the estimate**. That is wide, and the interface
does not hide it. It is also honest: on 2014–15 data with sixteen features and
no condition report, no photographs and no interior information, a ±27% band is
roughly what the evidence supports. A narrower band would be a claim the data
cannot back.

---

## 5. Error structure — where the model is actually weak

Aggregate metrics hide the shape of the error. Broken out by price decile on
the held-out split:

| Price band | n | Median APE | MAE | **Mean bias** |
|---|---|---|---|---|
| $81k – $246k | 432 | 12.0% | $34,986 | **+$23,893** |
| $246k – $295k | 434 | 7.8% | $32,540 | +$11,650 |
| $296k – $345k | 438 | 7.6% | $32,112 | +$4,490 |
| $346k – $400k | 446 | 7.4% | $41,213 | +$3,543 |
| $401k – $459k | 410 | 8.2% | $45,590 | +$6,783 |
| $459k – $525k | 432 | 6.8% | $45,322 | −$846 |
| $526k – $600k | 451 | 8.0% | $57,499 | −$5,594 |
| $601k – $717k | 413 | 7.5% | $60,345 | −$10,621 |
| $717k – $905k | 432 | 8.3% | $92,175 | −$26,836 |
| $906k – $5.11M | 432 | 12.2% | $205,769 | **−$101,995** |

Two findings worth stating plainly:

**The model regresses to the mean, systematically.** It overprices the cheapest
decile by ~$24k and underprices the most expensive by ~$102k. The sign flips
almost exactly at the median. This is expected behaviour for a squared-error
learner on a skewed target, but "expected" is not the same as "harmless": at the
top of the market the bias is a fifth of the MAE in that band. A seller of a
$1.5M home is being quoted low, consistently, not randomly.

**Accuracy is a U, not a line.** The middle 60% of the market is priced to
roughly 7–8% median error. Both ends degrade to ~12%. The model is best exactly
where the data is densest, which is the least surprising and most easily
forgotten fact about it.

### By segment

| Segment | n | Median APE | MAE |
|---|---|---|---|
| Waterfront | 33 | **21.0%** | $307,375 |
| Grade ≤ 6 | 485 | 12.2% | $47,387 |
| Built before 1940 | 645 | 10.9% | $81,022 |
| Grade ≥ 11 | 107 | 10.4% | $251,586 |
| Has basement | 1,739 | 9.5% | $79,740 |
| Built 2010+ | 239 | **6.0%** | $62,504 |

**Waterfront is the model's worst segment by a distance** — 21% median error on
33 held-out sales. Thirty-three examples is not enough to learn a ~213% premium
that also varies by *which* water, and the model cannot see which. This is not a
fixable shortcoming of the estimator; it is a shortcoming of the dataset, and
the right response is what the application already does: **hard-filter
comparables on waterfront status** so a waterfront estimate is at least shown
against waterfront evidence. (That filter was added after a Medina property
priced at $3.53M was displayed against a range of inland comps — §7.2 of the
[project report](PROJECT_REPORT.md).)

### Retransformation bias

Predicting in log space and inverting with `expm1` returns a conditional
*median*, not a mean. Across the held-out set:

```
mean(predicted $) / mean(actual $) = 0.9825
```

Predictions run **1.75% low in aggregate**. For a single-property estimate this
is immaterial and arguably correct — the median is the better point estimate for
"what will this sell for". It would matter for any portfolio-level total, where
1.75% compounds across every row. A Duan smearing correction is the standard
fix and is on the roadmap, gated behind an explicit aggregate-valuation use
case rather than applied blindly to the single-property path.

---

## 6. Explainability

The value breakdown is computed by **ablation**, not by a post-hoc attribution
library: price a median King County home, then substitute the user's values one
feature group at a time and record each delta.

Groups: *Size & Layout*, *Rooms*, *Quality & Condition*, *Location*,
*Waterfront & View*.

Gradient boosting is not additive, so those deltas do not sum to the final
price. The remainder is reported openly as **"Combined effects"** rather than
being quietly spread across the other rows to make the arithmetic look clean. A
test enforces that the column reconciles to the estimate.

A worked example from a live request (2,200 sqft, 3 bed, grade 8, lat 47.5112):

| Row | Value |
|---|---|
| Baseline: typical King County home | $534,169 |
| Size & Layout | +$23,231 |
| Quality & Condition | +$32,438 |
| Location | −$243,213 |
| Combined effects | +$53,373 |
| **Estimate** | **$399,379** |

Location moving the price by −$243k on a −0.06° latitude shift is not a bug; it
is the 31% importance figure made concrete, and it is the kind of thing an
agent can actually take to a listing appointment.

**Why not SHAP?** SHAP would be more theoretically principled. It would also
return sixteen per-feature values that a non-technical user cannot act on, and
it would not reconcile to a column that sums to the price. Ablation over five
named groups produces something a seller can be shown. That is a deliberate
trade of rigour for usability, stated here rather than hidden.

---

## 7. Honest limitations

- **The data is from May 2014 – May 2015.** This demonstrates method, not
  current market pricing. King County has moved substantially since. Every
  comparable in the UI carries its sale date for this reason.
- **Single county.** Latitude carrying 31% importance is a fact about *this*
  county's geography. The model does not transfer.
- **No temporal validation.** The split is random, not chronological, so the
  reported accuracy does not measure forecasting ability — only interpolation
  within a 12-month window. A time-based split would be the honest evaluation
  for a deployed AVM, and would score worse.
- **Thin coverage of the tails.** 33 waterfront and 107 grade-≥11 sales in the
  held-out set. Segment metrics there are indicative, not reliable.
- **No hyperparameter search.** Parameters were chosen by hand and held fixed.
  A proper `RandomizedSearchCV` with cross-validation would likely recover
  another point or two of R², and its absence is a gap rather than a decision.
- **No monitoring.** Nothing watches for drift between the training
  distribution and live request inputs.

---

## 8. Reproducing this report

```bash
cd propiq-backend
python scripts/train_model.py     # rewrites models/ and metrics.json
python -m pytest tests/ -v        # 116 tests, incl. model behaviour
```

The dataset is not redistributed. Download `kc_house_data.csv`
([Kaggle](https://www.kaggle.com/datasets/harlfoxem/housesalesprediction)) into
`propiq-backend/data/raw/` first.

Training is deterministic (`random_state=42`) and takes roughly two minutes.

---

*See also: [Project report](PROJECT_REPORT.md) · [API reference](API.md) · [Roadmap](ROADMAP.md)*

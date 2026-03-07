# Data Preprocessing Log — OWID Energy Dataset

## Source file
`owid-energy-data.csv` — 23,195 rows × 130 columns

## Output file
`owid-energy-data-cleaned.csv` — same dimensions, missing values reduced via mathematical imputation and trend extrapolation

---

## Pipeline overview

The pipeline runs three scripts in sequence:

```
impute_fossil_electricity.py
impute_renewables_electricity.py
impute_all_patterns.py
extrapolate_tail.py
```

---

## Step 1 — Fossil electricity imputation
**Script:** `preprocessing/impute_fossil_electricity.py`

**Constraint:** `fossil_electricity = coal_electricity + oil_electricity + gas_electricity`

The constraint holds to within 0.001 TWh across all fully-present rows (floating point only).

| Case | Condition | Action | Rows filled |
|---|---|---|---|
| A | coal + oil + fossil present, gas missing | gas = fossil − coal − oil → result ≈ 0 for all rows → fill 0 | 69 |
| B | coal + gas + fossil present, oil missing | oil = fossil − coal − gas → all results positive → fill computed | 45 |

**Not filled:** patterns with 2+ unknowns (16+30+57+15 rows) — one equation, two unknowns.

**Verification:** max constraint deviation after fill = 0.001 TWh, 0 rows > 0.1 TWh, no negatives.

---

## Step 2 — Renewables electricity imputation
**Script:** `preprocessing/impute_renewables_electricity.py`

**Constraint:** `renewables_electricity = solar + hydro + wind + biofuel + other_renewable_exc_biofuel_electricity`

This 5-component constraint was confirmed to hold to within 0.007 TWh. The simpler 4-component formula (without `other_renewable_exc_biofuel`) was tested but rejected — it fails for 955 rows by up to 88 TWh due to the missing fifth source.

| Case | Condition | Action | Rows filled |
|---|---|---|---|
| A | 4 components + renewables present, 1 component missing | computed residual ≈ 0 → fill 0 | solar: 5, hydro: 4, wind: 48, other_exc_bio: 571 |
| B | solar + hydro + wind + renewables present, biofuel + other_exc_bio both missing | residual ≈ 0 → both = 0 | 1,572 pairs (3,144 cells) |

**Not filled:** 1,774 rows where biofuel + other_exc_bio both missing with positive residual — cannot split two unknowns from one equation.

**Post-audit fix:** Switzerland 2023–2024 biofuel and other_exc_bio fills were reverted. The residual appeared ≈ 0 because `renewables_electricity` itself was incomplete for those years — filling with 0 would have been incorrect given that biofuel was ~1 TWh in surrounding years. Downstream `biofuel_elec_per_capita` and `biofuel_share_elec` were also reverted for those rows.

**Verification:** max constraint deviation = 0.007 TWh, 0 rows > 0.1 TWh, no negatives.

---

## Step 3 — Broad mathematical pattern imputation
**Script:** `preprocessing/impute_all_patterns.py`

Seven families of exact mathematical relationships were identified and verified across the dataset. All relationships hold to within floating-point precision (ratio = 1.000000 or max diff < 0.01).

### Type 1 — Electricity aggregate sum
`low_carbon_electricity = renewables_electricity + nuclear_electricity`

| Filled column | Rows |
|---|---|
| nuclear_electricity (from low_carbon − renewables) | 106 |

### Type 3 — Per-capita electricity
Formula: `*_elec_per_capita = *_electricity × 1e9 / population`

| Filled column | Rows |
|---|---|
| oil_elec_per_capita | 45 |
| gas_elec_per_capita | 69 |
| biofuel_elec_per_capita | 1,453 |
| hydro_elec_per_capita | 4 |
| wind_elec_per_capita | 48 |
| solar_elec_per_capita | 5 |
| nuclear_elec_per_capita | 106 |

### Type 5 — Share of electricity
Formula: `*_share_elec = *_electricity / electricity_generation × 100`

| Filled column | Rows |
|---|---|
| coal_share_elec | 23 |
| oil_share_elec | 45 |
| gas_share_elec | 69 |
| biofuel_share_elec | 512 |
| hydro_share_elec | 4 |
| wind_share_elec | 48 |
| solar_share_elec | 5 |
| nuclear_share_elec | 106 |
| fossil_share_elec | 23 |
| renewables_share_elec | 23 |
| low_carbon_share_elec | 23 |

### Type 8 — Electricity demand identity
`electricity_demand = electricity_generation + net_elec_imports`
`net_elec_imports_share_demand = net_elec_imports / electricity_demand × 100`

| Filled column | Rows |
|---|---|
| net_elec_imports | 310 |
| net_elec_imports_share_demand | 333 |

**Patterns identified but not used for imputation:**
- `*_share_energy` — holds with ratio ≈ 1.007 (systematic offset, not exact)
- `electricity_share_energy` — formula unclear, not reconstructable
- `*_cons_change_pct` for hydro, wind, solar, nuclear, renewables, low_carbon — systematic deviation from expected formula, likely uses a smoothed denominator
- Types 2, 4, 6, 7 (consumption sums, energy per capita, change TWh, change pct) — 0 fillable rows found: when one column is missing, related columns tend to be missing simultaneously

**Step 3 total cells filled: 3,521**

---

## Step 4 — Tail-end extrapolation (2023–2024)
**Script:** `preprocessing/extrapolate_tail.py`

**Context:** Linear interpolation was assessed but found inapplicable — there are zero mid-series gaps in any country's time series. All remaining missing values fall either at the historical start (before data collection began) or at the tail end (most recent years). Only tail-end gaps in 2023–2024 were filled.

**Columns:** `electricity_demand`, `electricity_generation`, `fossil_electricity`, `renewables_electricity`

**Method:** 1-step linear extrapolation using the last year-over-year slope:
`filled_value = last_known + slope × steps`  where `slope = last_known(t) − last_known(t−1)`

**Fallback to forward-fill** when `|slope / last_known| > 30%` — avoids amplifying noise in volatile small-country series.

**Skipped:** countries whose last known value predates 2020 (e.g. Western Sahara — 13-year gap; USSR — dissolved country). Filling these would be fabrication.

| Column | Extrapolated | Forward-filled | Total |
|---|---|---|---|
| electricity_demand | 82 | 1 | 83 |
| electricity_generation | 71 | 1 | 72 |
| fossil_electricity | 75 | 6 | 81 |
| renewables_electricity | 58 | 14 | 72 |

**Sample output (2022–2024):**

| Entity | Col | 2022 | 2023 (filled) | 2024 (filled) |
|---|---|---|---|---|
| EU27 | fossil_electricity | 1,088 TWh | 864 TWh | 641 TWh |
| EU27 | renewables_electricity | 1,079 TWh | 1,220 TWh | 1,361 TWh |
| China | electricity_demand | 8,836 TWh | 9,443 TWh | 10,073 TWh |
| World | renewables_electricity | 8,518 TWh | 8,977 TWh | 9,845 TWh |

**Verification:** no negative values introduced, volatile rows correctly used forward-fill.

---

## Total impact

| Step | Script | Cells filled |
|---|---|---|
| 1 | impute_fossil_electricity.py | 114 |
| 2 | impute_renewables_electricity.py | 3,772 |
| 3 | impute_all_patterns.py | 3,521 |
| 4 | extrapolate_tail.py | 308 |
| **Total** | | **7,715** |

---

## What was NOT filled

- **Historical leading gaps** (~12,000+ rows per column): years before data collection began for a country (e.g. 1900–1999 for Afghanistan). No left boundary exists for interpolation; filling would be fabrication.
- **Patterns with 2+ unknowns**: where a constraint equation has more than one missing value and they cannot be separated.
- **Western Sahara (2010–2022)** and **USSR (post-1984)**: stale or dissolved entities — not extrapolated.
- **Switzerland 2023–2024 biofuel**: reverted after audit revealed the total column was itself incomplete for those years.

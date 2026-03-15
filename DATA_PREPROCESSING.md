# Data Preprocessing — OWID Energy Dataset

**Source:** `owid-energy-data.csv` — 23,195 rows × 130 columns
**Notebook:** `code.ipynb`
**Final output:** `df_clean` — 114 countries, 1985–2024

---

## Overview

The raw OWID energy dataset covers every country and region in the world across dozens of energy metrics. Most of the 130 columns and many of the 23,195 rows are not relevant to the model. The preprocessing pipeline reduces this to a clean, analysis-ready dataframe using a combination of column selection, quality filtering, mathematical imputation, and conservative gap-filling.

---

## Step 1 — Column Selection

**Action:** Retained 18 columns from the original 130.

**Rationale:** The model focuses on electricity generation, demand, and fuel-type breakdown. The 18 selected columns cover the core electricity metrics (demand, generation, fossil, renewables, nuclear, and their components) plus supporting context (population, GDP, GHG emissions). All other columns — percentage changes, per-capita metrics, energy consumption, production figures — are either derivable from these or irrelevant to the modelling task.

**Columns retained:**
`country`, `year`, `iso_code`, `population`, `gdp`, `electricity_demand`, `electricity_generation`, `fossil_electricity`, `renewables_electricity`, `nuclear_electricity`, `coal_electricity`, `oil_electricity`, `gas_electricity`, `solar_electricity`, `wind_electricity`, `hydro_electricity`, `biofuel_electricity`, `greenhouse_gas_emissions`

---

## Step 2 — Year Filter

**Action:** Dropped all rows where `year < 1985`.

**Rationale:** Data quality and coverage improve significantly from 1985 onwards. Pre-1985 records are sparse, inconsistent, and not useful for the model's intended time range.

---

## Step 3 — Country Quality Filter

**Action:** Dropped countries where any of the four critical columns had more than 50% missing values. Kosovo was explicitly exempted.

**Critical columns:** `iso_code`, `population`, `electricity_generation`, `electricity_demand`

**Rationale:** A country missing more than half its data in any critical column cannot be reliably used for modelling. The 50% threshold is conservative enough to retain countries with partial data gaps while removing those with fundamentally incomplete records.

- 201 countries dropped → **114 countries retained**
- **Kosovo exemption:** Kosovo is a real, independent country but has no internationally assigned ISO code due to its disputed recognition status. It was explicitly kept because the absence of an ISO code is a political artefact, not a data quality issue.

---

## Step 4 — Solar and Wind Special Handling

**Action:** Zero-filled pre-2000 NaNs and leading post-2000 NaNs; forward-filled trailing NaNs.

**Rationale:** Solar and wind electricity generation is a recent phenomenon. Inspecting the raw data confirmed that every non-null pre-2000 value for both columns is already 0.0 — meaning the NaNs are not truly missing, they just reflect the absence of capacity. The same logic applies to leading post-2000 NaNs: a country like Bosnia had no wind farms until 2011, so the years 2000–2010 should be zero, not interpolated. Trailing NaNs (2023/2024) are a reporting lag and are handled by carrying the last known value forward.

| Gap type | Treatment | Reason |
|---|---|---|
| Pre-2000 NaNs | Zero-fill | No solar/wind capacity existed |
| Post-2000 leading NaNs | Zero-fill | Country hadn't built capacity yet |
| Trailing NaNs (2023/2024) | Forward-fill | Reporting lag — capacity exists but data unpublished |

---

## Step 5 — Fossil Electricity Imputation

**Constraint:** `fossil_electricity = coal_electricity + oil_electricity + gas_electricity`

**Action:** Used the constraint to solve for whichever column was missing, given the other three were known.

**Rationale:** This is an exact mathematical identity in the OWID dataset. When three of the four values are known, the fourth can be computed with certainty — no estimation involved.

| Case | Condition | Fill |
|---|---|---|
| A | coal + oil + fossil known, gas missing | `gas = 0` |
| B | coal + gas + fossil known, oil missing | `oil = fossil − coal − gas` |
| C | oil + gas + fossil known, coal missing | `coal = fossil − oil − gas` |
| D | coal + oil + gas known, fossil missing | `fossil = coal + oil + gas` |

Negative results are skipped — a computed negative indicates a data inconsistency that is safer to leave as NaN.

---

## Step 6 — Renewables Electricity Imputation

**Constraint:** `renewables_electricity = solar_electricity + hydro_electricity + wind_electricity + biofuel_electricity`

**Action:** Used the 4-component constraint to fill missing values in either the total or a single missing component.

**Rationale:** Same logic as fossil imputation — this is an exact identity. The formula uses 4 components (not 5) because `other_renewable_exc_biofuel_electricity` is outside the 18-column scope.

A threshold of **0.001 TWh** is applied when filling with zero — any residual below this is treated as a floating-point rounding artefact and filled as zero. Residuals above the threshold are filled with the computed value. This prevents incorrectly zeroing out cases where a small but real contribution exists (e.g. Switzerland).

| Case | Condition | Fill |
|---|---|---|
| A | 3 components + total known, 1 component missing | `missing = total − sum of others` |
| B | All 4 components known, total missing | `total = sum of 4 components` |

---

## Step 7 — Electricity Generation Imputation

**Constraint:** `electricity_generation = fossil_electricity + renewables_electricity + nuclear_electricity`

**Action:** Used the constraint to fill missing values in generation or its three components.

**Rationale:** Verified empirically against the full dataset — this identity holds exactly for 91% of rows. The 9% discrepancy comes exclusively from regional aggregates (Asia, World, Europe, etc.) which were removed in Step 3. For individual countries, the relationship is exact.

| Case | Condition | Fill |
|---|---|---|
| A | fossil + renewables + nuclear known, generation missing | `generation = sum of 3` |
| B | generation + 2 of 3 parts known, 1 part missing | `missing = generation − sum of others` |

---

## Step 8 — Forward-Fill Trailing NaNs

**Columns:** `gdp`, `electricity_demand`, `electricity_generation`, `nuclear_electricity`, `greenhouse_gas_emissions`, `coal_electricity`

**Action:** For each country, carried the last known value forward to fill trailing NaNs.

**Rationale:** These columns were identified as having smooth, slowly-changing year-over-year trends (median annual change of 1.5%–7.2%). Year-over-year volatility analysis confirmed they are safe to forward-fill. Trailing NaNs in 2023/2024 are a reporting lag — the underlying reality exists, the data just hasn't been published yet. Forward-fill is a conservative and defensible assumption for a one-to-two year gap.

Leading NaNs are left as NaN — these represent years before a country started reporting, and inventing values for them would be fabrication.

---

## Step 9 — Zero-Fill Leading NaNs for Capacity Columns

**Columns:** `coal_electricity`, `nuclear_electricity`, `hydro_electricity`, `biofuel_electricity`

**Action:** Zero-filled all leading NaNs per country. Countries with no data at all for a column were also fully zero-filled.

**Rationale:** For electricity generation by fuel type, the absence of historical data is almost always evidence of absent capacity — not missing reporting. A country that first reports coal electricity in 2005 did not suddenly start generating coal power that year; it simply had none before. This is distinct from columns like GDP where a missing value genuinely means unknown, not zero. Filling these with zero is physically meaningful and prevents them from being dropped downstream.

---

## Summary of Gap Filling

| Step | Method | Columns |
|---|---|---|
| 4 | Zero-fill (leading) + forward-fill (trailing) | `solar_electricity`, `wind_electricity` |
| 5 | Mathematical constraint | `coal`, `oil`, `gas`, `fossil_electricity` |
| 6 | Mathematical constraint | `solar`, `hydro`, `wind`, `biofuel`, `renewables_electricity` |
| 7 | Mathematical constraint | `fossil`, `renewables`, `nuclear`, `electricity_generation` |
| 8 | Forward-fill (trailing only) | `gdp`, `electricity_demand`, `electricity_generation`, `nuclear_electricity`, `greenhouse_gas_emissions`, `coal_electricity` |
| 9 | Zero-fill (leading only) | `coal`, `nuclear`, `hydro`, `biofuel_electricity` |

---

## What Was Deliberately Left as NaN

- **Leading NaNs in `gdp`, `electricity_demand`, `electricity_generation`, `greenhouse_gas_emissions`** — these represent years before a country had data. Imputing them would be fabrication.
- **Negative residuals from constraint imputation** — a computed negative signals a data inconsistency in the source. These are left as NaN rather than propagating bad values.
- **Interior gaps in any column** — analysis confirmed there are virtually no interior gaps in the dataset after filtering. The one or two that exist are left as NaN.

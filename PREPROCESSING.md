# Data Preprocessing Log — OWID Energy Dataset

**Source:** `owid-energy-data.csv` — 23,195 rows × 130 columns
**Pipeline:** `code.py` (`python3 code.py`)
**Final output:** `data/model_dataset.csv` — 667 rows × 18 columns, 28 countries, 2000–2023, 0 missing values

---

## What was done

### Step 1 — Fossil electricity imputation
Constraint: `fossil_electricity = coal + oil + gas`

- Gas missing, coal + oil + fossil present → gas = 0 (69 rows)
- Oil missing, coal + gas + fossil present → oil = fossil − coal − gas (45 rows)

### Step 2 — Renewables electricity imputation
Constraint: `renewables = solar + hydro + wind + biofuel + other_renewable_exc_biofuel`

- Single component missing, residual ≈ 0 → fill 0 (628 rows)
- Biofuel + other_exc_bio both missing, residual ≈ 0 → both = 0 (1,572 row pairs)
- Threshold set at 0.001 TWh to prevent incorrect zero-fills (Switzerland edge case)

### Step 3 — Mathematical pattern imputation
Seven exact relationships identified across the dataset:

| Type | Formula | Cells filled |
|---|---|---|
| Low-carbon sum | `low_carbon = renewables + nuclear` | 106 |
| Per-capita electricity | `*_elec_per_capita = *_electricity × 1e9 / population` | 1,730 |
| Share of electricity | `*_share_elec = *_electricity / generation × 100` | 1,352 |
| Demand identity | `demand = generation + net_imports` | 643 |

### Step 4 — Tail-end extrapolation (2023–2024)
Columns: `electricity_demand`, `electricity_generation`, `fossil_electricity`, `renewables_electricity`

- Method: `filled = last_known + slope × steps` where `slope = last(t) − last(t−1)`
- Fallback to forward-fill when year-over-year change > 30% (volatile series)
- Skipped countries with last known value before 2020

| Column | Extrapolated | Forward-filled |
|---|---|---|
| electricity_demand | 82 | 1 |
| electricity_generation | 71 | 1 |
| fossil_electricity | 75 | 6 |
| renewables_electricity | 58 | 14 |

### Step 5 — Build model dataset
Filtered to 28 countries, 2000–2023, 18 core columns. Country-specific fixes:

- **Palestine 2023** — electricity components derived from constraints (no coal/gas/wind/hydro/nuclear capacity)
- **Montenegro 2005** — `primary_energy_consumption` back-filled from 2006 (data starts at independence)
- **GDP 2023** — linear extrapolation per country; Ukraine forward-filled from 2022 (war-year slope unreliable)
- **GHG emissions & carbon intensity 2023** — forward-filled per country

---

## Total cells filled

| Step | Cells filled |
|---|---|
| 1 — Fossil imputation | 114 |
| 2 — Renewables imputation | 3,772 |
| 3 — Pattern imputation | 3,521 |
| 4 — Tail extrapolation | 308 |
| **Total** | **7,715** |

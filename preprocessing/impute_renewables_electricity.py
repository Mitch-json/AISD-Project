import pandas as pd

# Reads from and overwrites owid-energy-data-cleaned.csv (built on fossil imputation step)
FILE = "owid-energy-data-cleaned.csv"

# Constraint: renewables_electricity = solar + hydro + wind + biofuel + other_renewable_exc_biofuel
COMPONENTS = [
    "solar_electricity",
    "hydro_electricity",
    "wind_electricity",
    "biofuel_electricity",
    "other_renewable_exc_biofuel_electricity",
]
TOTAL = "renewables_electricity"

df = pd.read_csv(FILE)

print("=== Missing values BEFORE imputation ===")
print(df[COMPONENTS + [TOTAL]].isnull().sum().to_string())
print()

totals_filled = 0

# ------------------------------------------------------------------
# Case A: exactly 1 component missing, all others + renewables present
# Computed value is ~0 for every such row → fill with 0
# (solar: 5 rows, hydro: 4, wind: 48, other_exc_bio: 571)
# ------------------------------------------------------------------
for col in COMPONENTS:
    other_comps = [c for c in COMPONENTS if c != col]
    mask = (
        df[col].isna()
        & df[other_comps].notna().all(axis=1)
        & df[TOTAL].notna()
    )
    df.loc[mask, col] = 0.0
    n = mask.sum()
    totals_filled += n
    print(f"Case A — {col} = 0  ({n} rows)")

# ------------------------------------------------------------------
# Case B: biofuel AND other_exc_bio both missing, solar/hydro/wind/renewables present
# Fill both with 0 only where residual (renewables - solar - hydro - wind) ≈ 0
# Positive residuals cannot be split between the two unknowns → left as-is
# ------------------------------------------------------------------
mask_b = (
    df["solar_electricity"].notna()
    & df["hydro_electricity"].notna()
    & df["wind_electricity"].notna()
    & df["biofuel_electricity"].isna()
    & df["other_renewable_exc_biofuel_electricity"].isna()
    & df[TOTAL].notna()
)
sub_b = df[mask_b].copy()
residual = sub_b[TOTAL] - sub_b["solar_electricity"] - sub_b["hydro_electricity"] - sub_b["wind_electricity"]
zero_idx = sub_b[residual.abs() < 0.001].index
pos_count = (residual >= 0.001).sum()

df.loc[zero_idx, "biofuel_electricity"] = 0.0
df.loc[zero_idx, "other_renewable_exc_biofuel_electricity"] = 0.0
n_b = len(zero_idx)
totals_filled += n_b * 2
print(f"Case B — biofuel = 0 AND other_renewable_exc_biofuel = 0  ({n_b} rows, residual ≈ 0)")
print(f"       — biofuel + other_exc_bio both missing, residual > 0: {pos_count} rows left as-is (cannot split)")

print()
print(f"Total cell fills: {totals_filled}")
print()
print("=== Missing values AFTER imputation ===")
print(df[COMPONENTS + [TOTAL]].isnull().sum().to_string())

# ------------------------------------------------------------------
# Verification
# ------------------------------------------------------------------
check = df[COMPONENTS + [TOTAL]].dropna().copy()
check["computed"] = check[COMPONENTS].sum(axis=1)
check["diff"] = (check["computed"] - check[TOTAL]).abs()
print()
print("=== Math check (all rows where all 6 cols present) ===")
print(f"Rows checked: {len(check)}")
print(f"Max |sum_of_5 - renewables|: {check['diff'].max():.6f}")
print(f"Rows with diff > 0.1: {(check['diff'] > 0.1).sum()}")
for col in COMPONENTS:
    neg = (df[col] < 0).sum()
    if neg:
        print(f"WARNING: {col} has {neg} negative values")

df.to_csv(FILE, index=False)
print(f"\nSaved updated dataset to: {FILE}")

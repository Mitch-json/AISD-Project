import pandas as pd

FILE = "owid-energy-data-cleaned.csv"
COLS = ["electricity_demand", "electricity_generation", "fossil_electricity", "renewables_electricity"]
VOLATILE_THRESH = 0.30   # fallback to ffill if YoY change > 30%
MIN_LAST_KNOWN_YEAR = 2020  # skip if last known value is too stale

df = pd.read_csv(FILE)
df = df.sort_values(["country", "year"]).reset_index(drop=True)

totals = {col: {"extrap": 0, "ffill": 0} for col in COLS}

for col in COLS:
    for country, grp in df.groupby("country"):
        idx = grp.index.tolist()
        vals = grp[col].tolist()

        # Find last non-null position
        known = [(i, v) for i, v in zip(idx, vals) if pd.notna(v)]
        if len(known) < 2:
            continue

        last_i, last_v = known[-1]
        prev_i, prev_v = known[-2]
        last_year = df.at[last_i, "year"]

        if last_year < MIN_LAST_KNOWN_YEAR:
            continue

        slope = last_v - prev_v
        volatile = abs(slope / last_v) > VOLATILE_THRESH if last_v != 0 else True

        # Fill any missing rows after the last known value, years 2023-2024 only
        for i, v in zip(idx, vals):
            if pd.isna(v) and df.at[i, "year"] > last_year and df.at[i, "year"] in (2023, 2024):
                steps = df.at[i, "year"] - last_year
                if volatile:
                    df.at[i, col] = last_v
                    totals[col]["ffill"] += 1
                else:
                    df.at[i, col] = last_v + slope * steps
                    totals[col]["extrap"] += 1

print("=== Extrapolation summary ===")
for col in COLS:
    e, f = totals[col]["extrap"], totals[col]["ffill"]
    print(f"  {col}: {e} extrapolated, {f} forward-filled  (total {e+f})")

print()
print("=== Sample: major entities ===")
sample = ["World", "United States", "China", "European Union (27)", "Africa"]
print(df[df["country"].isin(sample) & df["year"].isin([2022, 2023, 2024])][
    ["country", "year"] + COLS
].sort_values(["country", "year"]).to_string(index=False))

df.to_csv(FILE, index=False)
print(f"\nSaved to {FILE}")

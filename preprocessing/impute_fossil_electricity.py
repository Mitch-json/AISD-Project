import pandas as pd

INPUT_FILE = "owid-energy-data.csv"
OUTPUT_FILE = "owid-energy-data-cleaned.csv"

COLS = ["coal_electricity", "oil_electricity", "gas_electricity", "fossil_electricity"]

df = pd.read_csv(INPUT_FILE)

print("=== Missing values BEFORE imputation ===")
print(df[COLS].isnull().sum().to_string())
print()

# Case A: gas_electricity is missing, coal + oil + fossil are present
# Computed gas = fossil - coal - oil ≈ 0 for all such rows → fill with 0
mask_a = (
    df["coal_electricity"].notna()
    & df["oil_electricity"].notna()
    & df["gas_electricity"].isna()
    & df["fossil_electricity"].notna()
)
df.loc[mask_a, "gas_electricity"] = 0.0
print(f"Case A: filled gas_electricity = 0 for {mask_a.sum()} rows")

# Case B: oil_electricity is missing, coal + gas + fossil are present
# Computed oil = fossil - coal - gas (all positive values)
mask_b = (
    df["coal_electricity"].notna()
    & df["oil_electricity"].isna()
    & df["gas_electricity"].notna()
    & df["fossil_electricity"].notna()
)
df.loc[mask_b, "oil_electricity"] = (
    df.loc[mask_b, "fossil_electricity"]
    - df.loc[mask_b, "coal_electricity"]
    - df.loc[mask_b, "gas_electricity"]
)
print(f"Case B: filled oil_electricity = fossil - coal - gas for {mask_b.sum()} rows")

print()
print("=== Missing values AFTER imputation ===")
print(df[COLS].isnull().sum().to_string())

# Verification: coal + oil + gas should equal fossil for all fully-present rows
check = df[COLS].dropna().copy()
check["computed"] = check["coal_electricity"] + check["oil_electricity"] + check["gas_electricity"]
check["diff"] = (check["computed"] - check["fossil_electricity"]).abs()
print()
print(f"=== Math check (all rows where all 4 cols present) ===")
print(f"Rows checked: {len(check)}")
print(f"Max |coal+oil+gas - fossil|: {check['diff'].max():.6f}")
print(f"Rows with diff > 0.1: {(check['diff'] > 0.1).sum()}")
print(f"Any negative oil values introduced: {(df['oil_electricity'] < 0).sum()}")
print(f"Any negative gas values introduced: {(df['gas_electricity'] < 0).sum()}")

df.to_csv(OUTPUT_FILE, index=False)
print(f"\nSaved cleaned dataset to: {OUTPUT_FILE}")

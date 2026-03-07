import pandas as pd
import numpy as np

FILE = "owid-energy-data-cleaned.csv"
df = pd.read_csv(FILE)

total_filled = 0
summary = {}

def report(label, n):
    global total_filled
    total_filled += n
    summary[label] = n
    if n > 0:
        print(f"  {label}: {n} cells filled")


# ===========================================================================
# TYPE 1 — Sum: low_carbon_electricity = renewables_electricity + nuclear_electricity
# ===========================================================================
print("\n=== TYPE 1: low_carbon_electricity = renewables + nuclear ===")

def impute_sum(df, total_col, part_cols, zero_thresh=0.001):
    filled = 0
    # Case: exactly 1 part missing
    for missing in part_cols:
        others = [c for c in part_cols if c != missing]
        mask = df[missing].isna() & df[others].notna().all(axis=1) & df[total_col].notna()
        if mask.sum() == 0:
            continue
        computed = df.loc[mask, total_col] - df.loc[mask, others].sum(axis=1)
        zero_idx = computed[computed.abs() < zero_thresh].index
        pos_idx  = computed[computed >= zero_thresh].index
        neg_idx  = computed[computed < -zero_thresh].index
        df.loc[zero_idx, missing] = 0.0
        df.loc[pos_idx,  missing] = computed[pos_idx]
        n = len(zero_idx) + len(pos_idx)
        filled += n
        report(f"{missing} (from {total_col})", n)
        if len(neg_idx):
            print(f"    WARNING: {len(neg_idx)} rows computed negative for {missing} — skipped")
    # Case: total missing, all parts present
    mask_t = df[total_col].isna() & df[part_cols].notna().all(axis=1)
    if mask_t.sum() > 0:
        df.loc[mask_t, total_col] = df.loc[mask_t, part_cols].sum(axis=1)
        n = mask_t.sum()
        filled += n
        report(f"{total_col} (sum of parts)", n)
    return filled

impute_sum(df, "low_carbon_electricity", ["renewables_electricity", "nuclear_electricity"])


# ===========================================================================
# TYPE 2 — Sum: Consumption aggregates
# ===========================================================================
print("\n=== TYPE 2: Consumption sums ===")

impute_sum(df, "fossil_fuel_consumption",
           ["coal_consumption", "oil_consumption", "gas_consumption"])

impute_sum(df, "renewables_consumption",
           ["hydro_consumption", "solar_consumption", "wind_consumption",
            "biofuel_consumption", "other_renewable_consumption"])

impute_sum(df, "low_carbon_consumption",
           ["renewables_consumption", "nuclear_consumption"])


# ===========================================================================
# TYPE 3 — Per capita: Electricity   col_per_capita = col * 1e9 / population
# ===========================================================================
print("\n=== TYPE 3: Per-capita electricity ===")

ELEC_PC_PAIRS = [
    ("coal_electricity",        "coal_elec_per_capita"),
    ("oil_electricity",         "oil_elec_per_capita"),
    ("gas_electricity",         "gas_elec_per_capita"),
    ("biofuel_electricity",     "biofuel_elec_per_capita"),
    ("hydro_electricity",       "hydro_elec_per_capita"),
    ("wind_electricity",        "wind_elec_per_capita"),
    ("solar_electricity",       "solar_elec_per_capita"),
    ("nuclear_electricity",     "nuclear_elec_per_capita"),
    ("fossil_electricity",      "fossil_elec_per_capita"),
    ("renewables_electricity",  "renewables_elec_per_capita"),
    ("low_carbon_electricity",  "low_carbon_elec_per_capita"),
    ("electricity_generation",  "per_capita_electricity"),
    ("electricity_demand",      "electricity_demand_per_capita"),
]

for elec_col, pc_col in ELEC_PC_PAIRS:
    if elec_col not in df.columns or pc_col not in df.columns:
        continue
    # Fill per_capita from electricity + population
    mask1 = df[pc_col].isna() & df[elec_col].notna() & df["population"].notna()
    df.loc[mask1, pc_col] = df.loc[mask1, elec_col] * 1e9 / df.loc[mask1, "population"]
    report(f"{pc_col} (from {elec_col})", mask1.sum())
    # Fill electricity from per_capita + population
    mask2 = df[elec_col].isna() & df[pc_col].notna() & df["population"].notna()
    df.loc[mask2, elec_col] = df.loc[mask2, pc_col] * df.loc[mask2, "population"] / 1e9
    report(f"{elec_col} (from {pc_col})", mask2.sum())


# ===========================================================================
# TYPE 4 — Per capita: Energy   energy_per_capita = consumption * 1e9 / population
#          Energy per GDP:      energy_per_gdp    = consumption * 1e9 / gdp
# ===========================================================================
print("\n=== TYPE 4: Per-capita energy + energy_per_gdp ===")

ENERGY_PC_PAIRS = [
    ("oil_consumption",             "oil_energy_per_capita"),
    ("gas_consumption",             "gas_energy_per_capita"),
    ("hydro_consumption",           "hydro_energy_per_capita"),
    ("wind_consumption",            "wind_energy_per_capita"),
    ("solar_consumption",           "solar_energy_per_capita"),
    ("nuclear_consumption",         "nuclear_energy_per_capita"),
    ("fossil_fuel_consumption",     "fossil_energy_per_capita"),
    ("renewables_consumption",      "renewables_energy_per_capita"),
    ("low_carbon_consumption",      "low_carbon_energy_per_capita"),
    ("primary_energy_consumption",  "energy_per_capita"),
]

for cons_col, pc_col in ENERGY_PC_PAIRS:
    if cons_col not in df.columns or pc_col not in df.columns:
        continue
    mask1 = df[pc_col].isna() & df[cons_col].notna() & df["population"].notna()
    df.loc[mask1, pc_col] = df.loc[mask1, cons_col] * 1e9 / df.loc[mask1, "population"]
    report(f"{pc_col} (from {cons_col})", mask1.sum())
    mask2 = df[cons_col].isna() & df[pc_col].notna() & df["population"].notna()
    df.loc[mask2, cons_col] = df.loc[mask2, pc_col] * df.loc[mask2, "population"] / 1e9
    report(f"{cons_col} (from {pc_col})", mask2.sum())

# energy_per_gdp = primary_energy_consumption * 1e9 / gdp
mask_gdp1 = df["energy_per_gdp"].isna() & df["primary_energy_consumption"].notna() & df["gdp"].notna()
df.loc[mask_gdp1, "energy_per_gdp"] = df.loc[mask_gdp1, "primary_energy_consumption"] * 1e9 / df.loc[mask_gdp1, "gdp"]
report("energy_per_gdp (from primary_energy_consumption)", mask_gdp1.sum())

mask_gdp2 = df["primary_energy_consumption"].isna() & df["energy_per_gdp"].notna() & df["gdp"].notna()
df.loc[mask_gdp2, "primary_energy_consumption"] = df.loc[mask_gdp2, "energy_per_gdp"] * df.loc[mask_gdp2, "gdp"] / 1e9
report("primary_energy_consumption (from energy_per_gdp)", mask_gdp2.sum())


# ===========================================================================
# TYPE 5 — Share of electricity   share_elec = electricity / generation * 100
# ===========================================================================
print("\n=== TYPE 5: Share of electricity ===")

SHARE_ELEC_PAIRS = [
    ("coal_electricity",       "coal_share_elec"),
    ("oil_electricity",        "oil_share_elec"),
    ("gas_electricity",        "gas_share_elec"),
    ("biofuel_electricity",    "biofuel_share_elec"),
    ("hydro_electricity",      "hydro_share_elec"),
    ("wind_electricity",       "wind_share_elec"),
    ("solar_electricity",      "solar_share_elec"),
    ("nuclear_electricity",    "nuclear_share_elec"),
    ("fossil_electricity",     "fossil_share_elec"),
    ("renewables_electricity", "renewables_share_elec"),
    ("low_carbon_electricity", "low_carbon_share_elec"),
]

for elec_col, share_col in SHARE_ELEC_PAIRS:
    if elec_col not in df.columns or share_col not in df.columns:
        continue
    gen_col = "electricity_generation"
    # Fill share from electricity + generation
    mask1 = df[share_col].isna() & df[elec_col].notna() & df[gen_col].notna()
    df.loc[mask1, share_col] = df.loc[mask1, elec_col] / df.loc[mask1, gen_col] * 100
    report(f"{share_col} (from {elec_col})", mask1.sum())
    # Fill electricity from share + generation
    mask2 = df[elec_col].isna() & df[share_col].notna() & df[gen_col].notna()
    df.loc[mask2, elec_col] = df.loc[mask2, share_col] / 100 * df.loc[mask2, gen_col]
    report(f"{elec_col} (from {share_col})", mask2.sum())


# ===========================================================================
# TYPE 6 — Year-over-year change TWh
# ===========================================================================
print("\n=== TYPE 6: Change TWh (year-over-year) ===")

df = df.sort_values(["country", "year"]).reset_index(drop=True)

CONS_CHANGE_TWH = [
    ("coal_consumption",            "coal_cons_change_twh"),
    ("oil_consumption",             "oil_cons_change_twh"),
    ("gas_consumption",             "gas_cons_change_twh"),
    ("biofuel_consumption",         "biofuel_cons_change_twh"),
    ("hydro_consumption",           "hydro_cons_change_twh"),
    ("wind_consumption",            "wind_cons_change_twh"),
    ("solar_consumption",           "solar_cons_change_twh"),
    ("nuclear_consumption",         "nuclear_cons_change_twh"),
    ("fossil_fuel_consumption",     "fossil_cons_change_twh"),
    ("renewables_consumption",      "renewables_cons_change_twh"),
    ("low_carbon_consumption",      "low_carbon_cons_change_twh"),
    ("primary_energy_consumption",  "energy_cons_change_twh"),
]
PROD_CHANGE_TWH = [
    ("coal_production", "coal_prod_change_twh"),
    ("oil_production",  "oil_prod_change_twh"),
    ("gas_production",  "gas_prod_change_twh"),
]

for cons_col, chg_col in CONS_CHANGE_TWH + PROD_CHANGE_TWH:
    if cons_col not in df.columns or chg_col not in df.columns:
        continue
    prev_col = f"_prev_{cons_col}"
    df[prev_col] = df.groupby("country")[cons_col].shift(1)
    mask = df[chg_col].isna() & df[cons_col].notna() & df[prev_col].notna()
    df.loc[mask, chg_col] = df.loc[mask, cons_col] - df.loc[mask, prev_col]
    report(f"{chg_col}", mask.sum())
    df.drop(columns=[prev_col], inplace=True)


# ===========================================================================
# TYPE 7 — Change Pct = change_twh / consumption(t-1) * 100
# Only for stable sources (coal, oil, gas, biofuel, fossil, energy)
# ===========================================================================
print("\n=== TYPE 7: Change Pct ===")

CONS_CHANGE_PCT = [
    ("coal_consumption",           "coal_cons_change_twh",    "coal_cons_change_pct"),
    ("oil_consumption",            "oil_cons_change_twh",     "oil_cons_change_pct"),
    ("gas_consumption",            "gas_cons_change_twh",     "gas_cons_change_pct"),
    ("biofuel_consumption",        "biofuel_cons_change_twh", "biofuel_cons_change_pct"),
    ("fossil_fuel_consumption",    "fossil_cons_change_twh",  "fossil_cons_change_pct"),
    ("primary_energy_consumption", "energy_cons_change_twh",  "energy_cons_change_pct"),
]

for cons_col, chg_twh_col, chg_pct_col in CONS_CHANGE_PCT:
    if not all(c in df.columns for c in [cons_col, chg_twh_col, chg_pct_col]):
        continue
    prev_col = f"_prev_{cons_col}"
    df[prev_col] = df.groupby("country")[cons_col].shift(1)
    mask = df[chg_pct_col].isna() & df[chg_twh_col].notna() & df[prev_col].notna() & (df[prev_col] != 0)
    df.loc[mask, chg_pct_col] = df.loc[mask, chg_twh_col] / df.loc[mask, prev_col] * 100
    report(f"{chg_pct_col}", mask.sum())
    df.drop(columns=[prev_col], inplace=True)


# ===========================================================================
# TYPE 8 — Electricity demand identity
# ===========================================================================
print("\n=== TYPE 8: Electricity demand identity ===")

# electricity_demand = electricity_generation + net_elec_imports
for missing, a, b in [
    ("electricity_demand",      "electricity_generation", "net_elec_imports"),
    ("electricity_generation",  "electricity_demand",     "net_elec_imports"),
    ("net_elec_imports",        "electricity_demand",     "electricity_generation"),
]:
    mask = df[missing].isna() & df[a].notna() & df[b].notna()
    if missing == "electricity_generation":
        df.loc[mask, missing] = df.loc[mask, a] - df.loc[mask, b]
    elif missing == "net_elec_imports":
        df.loc[mask, missing] = df.loc[mask, a] - df.loc[mask, b]
    else:
        df.loc[mask, missing] = df.loc[mask, a] + df.loc[mask, b]
    report(f"{missing} (demand identity)", mask.sum())

# net_elec_imports_share_demand = net_elec_imports / electricity_demand * 100
mask_s1 = df["net_elec_imports_share_demand"].isna() & df["net_elec_imports"].notna() & df["electricity_demand"].notna()
df.loc[mask_s1, "net_elec_imports_share_demand"] = df.loc[mask_s1, "net_elec_imports"] / df.loc[mask_s1, "electricity_demand"] * 100
report("net_elec_imports_share_demand", mask_s1.sum())

mask_s2 = df["net_elec_imports"].isna() & df["net_elec_imports_share_demand"].notna() & df["electricity_demand"].notna()
df.loc[mask_s2, "net_elec_imports"] = df.loc[mask_s2, "net_elec_imports_share_demand"] / 100 * df.loc[mask_s2, "electricity_demand"]
report("net_elec_imports (from share + demand)", mask_s2.sum())


# ===========================================================================
# SUMMARY
# ===========================================================================
print(f"\n{'='*60}")
print(f"TOTAL CELLS FILLED: {total_filled}")
print(f"{'='*60}")

# Drop helper columns if any leaked through
helper_cols = [c for c in df.columns if c.startswith("_prev_")]
if helper_cols:
    df.drop(columns=helper_cols, inplace=True)

df.to_csv(FILE, index=False)
print(f"\nSaved updated dataset to: {FILE}")

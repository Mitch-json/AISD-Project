import pandas as pd
import numpy as np
import os

INPUT_FILE  = "owid-energy-data.csv"
CLEANED_FILE = "owid-energy-data-cleaned.csv"
MODEL_FILE  = "data/model_dataset.csv"


# ===========================================================================
# STEP 1 — Fossil electricity imputation
# Constraint: fossil_electricity = coal + oil + gas
# ===========================================================================
def step1_impute_fossil(df):
    print("=" * 60)
    print("STEP 1: Fossil electricity imputation")
    print("=" * 60)

    COLS = ["coal_electricity", "oil_electricity", "gas_electricity", "fossil_electricity"]
    print("Missing BEFORE:")
    print(df[COLS].isnull().sum().to_string())

    # Case A: gas missing, coal + oil + fossil present → gas ≈ 0
    mask_a = (
        df["coal_electricity"].notna()
        & df["oil_electricity"].notna()
        & df["gas_electricity"].isna()
        & df["fossil_electricity"].notna()
    )
    df.loc[mask_a, "gas_electricity"] = 0.0
    print(f"\nCase A: filled gas_electricity = 0  ({mask_a.sum()} rows)")

    # Case B: oil missing, coal + gas + fossil present → oil = fossil - coal - gas
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
    print(f"Case B: filled oil_electricity = fossil - coal - gas  ({mask_b.sum()} rows)")

    print("\nMissing AFTER:")
    print(df[COLS].isnull().sum().to_string())

    # Verification
    check = df[COLS].dropna().copy()
    check["computed"] = check["coal_electricity"] + check["oil_electricity"] + check["gas_electricity"]
    check["diff"] = (check["computed"] - check["fossil_electricity"]).abs()
    print(f"\nVerification — rows checked: {len(check)}")
    print(f"  Max |coal+oil+gas - fossil|: {check['diff'].max():.6f}")
    print(f"  Rows with diff > 0.1: {(check['diff'] > 0.1).sum()}")
    print(f"  Negative oil values: {(df['oil_electricity'] < 0).sum()}")
    print(f"  Negative gas values: {(df['gas_electricity'] < 0).sum()}")

    return df


# ===========================================================================
# STEP 2 — Renewables electricity imputation
# Constraint: renewables = solar + hydro + wind + biofuel + other_renewable_exc_biofuel
# ===========================================================================
def step2_impute_renewables(df):
    print("\n" + "=" * 60)
    print("STEP 2: Renewables electricity imputation")
    print("=" * 60)

    COMPONENTS = [
        "solar_electricity",
        "hydro_electricity",
        "wind_electricity",
        "biofuel_electricity",
        "other_renewable_exc_biofuel_electricity",
    ]
    TOTAL = "renewables_electricity"

    print("Missing BEFORE:")
    print(df[COMPONENTS + [TOTAL]].isnull().sum().to_string())

    totals_filled = 0

    # Case A: exactly 1 component missing, all others + renewables present → residual ≈ 0, fill 0
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

    # Case B: biofuel AND other_exc_bio both missing, residual ≈ 0 → both = 0
    mask_b = (
        df["solar_electricity"].notna()
        & df["hydro_electricity"].notna()
        & df["wind_electricity"].notna()
        & df["biofuel_electricity"].isna()
        & df["other_renewable_exc_biofuel_electricity"].isna()
        & df[TOTAL].notna()
    )
    sub_b = df[mask_b].copy()
    residual = (
        sub_b[TOTAL]
        - sub_b["solar_electricity"]
        - sub_b["hydro_electricity"]
        - sub_b["wind_electricity"]
    )
    zero_idx = sub_b[residual.abs() < 0.001].index
    pos_count = (residual >= 0.001).sum()
    df.loc[zero_idx, "biofuel_electricity"] = 0.0
    df.loc[zero_idx, "other_renewable_exc_biofuel_electricity"] = 0.0
    n_b = len(zero_idx)
    totals_filled += n_b * 2
    print(f"Case B — biofuel = 0 AND other_renewable_exc_biofuel = 0  ({n_b} rows, residual ≈ 0)")
    print(f"       — biofuel + other_exc_bio both missing, residual > 0: {pos_count} rows left as-is")

    print(f"\nTotal cells filled: {totals_filled}")
    print("\nMissing AFTER:")
    print(df[COMPONENTS + [TOTAL]].isnull().sum().to_string())

    # Verification
    check = df[COMPONENTS + [TOTAL]].dropna().copy()
    check["computed"] = check[COMPONENTS].sum(axis=1)
    check["diff"] = (check["computed"] - check[TOTAL]).abs()
    print(f"\nVerification — rows checked: {len(check)}")
    print(f"  Max |sum_of_5 - renewables|: {check['diff'].max():.6f}")
    print(f"  Rows with diff > 0.1: {(check['diff'] > 0.1).sum()}")

    return df


# ===========================================================================
# STEP 3 — Broad mathematical pattern imputation
# ===========================================================================
def step3_impute_all_patterns(df):
    print("\n" + "=" * 60)
    print("STEP 3: Broad mathematical pattern imputation")
    print("=" * 60)

    total_filled = 0
    summary = {}

    def report(label, n):
        nonlocal total_filled
        total_filled += n
        summary[label] = n
        if n > 0:
            print(f"  {label}: {n} cells filled")

    def impute_sum(df, total_col, part_cols, zero_thresh=0.001):
        filled = 0
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
        mask_t = df[total_col].isna() & df[part_cols].notna().all(axis=1)
        if mask_t.sum() > 0:
            df.loc[mask_t, total_col] = df.loc[mask_t, part_cols].sum(axis=1)
            n = mask_t.sum()
            filled += n
            report(f"{total_col} (sum of parts)", n)
        return filled

    # Type 1 — low_carbon_electricity = renewables + nuclear
    print("\n--- Type 1: low_carbon_electricity = renewables + nuclear ---")
    impute_sum(df, "low_carbon_electricity", ["renewables_electricity", "nuclear_electricity"])

    # Type 2 — Consumption aggregates
    print("\n--- Type 2: Consumption sums ---")
    impute_sum(df, "fossil_fuel_consumption",
               ["coal_consumption", "oil_consumption", "gas_consumption"])
    impute_sum(df, "renewables_consumption",
               ["hydro_consumption", "solar_consumption", "wind_consumption",
                "biofuel_consumption", "other_renewable_consumption"])
    impute_sum(df, "low_carbon_consumption",
               ["renewables_consumption", "nuclear_consumption"])

    # Type 3 — Per-capita electricity
    print("\n--- Type 3: Per-capita electricity ---")
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
        mask1 = df[pc_col].isna() & df[elec_col].notna() & df["population"].notna()
        df.loc[mask1, pc_col] = df.loc[mask1, elec_col] * 1e9 / df.loc[mask1, "population"]
        report(f"{pc_col} (from {elec_col})", mask1.sum())
        mask2 = df[elec_col].isna() & df[pc_col].notna() & df["population"].notna()
        df.loc[mask2, elec_col] = df.loc[mask2, pc_col] * df.loc[mask2, "population"] / 1e9
        report(f"{elec_col} (from {pc_col})", mask2.sum())

    # Type 4 — Per-capita energy + energy_per_gdp
    print("\n--- Type 4: Per-capita energy + energy_per_gdp ---")
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
    mask_gdp1 = df["energy_per_gdp"].isna() & df["primary_energy_consumption"].notna() & df["gdp"].notna()
    df.loc[mask_gdp1, "energy_per_gdp"] = df.loc[mask_gdp1, "primary_energy_consumption"] * 1e9 / df.loc[mask_gdp1, "gdp"]
    report("energy_per_gdp (from primary_energy_consumption)", mask_gdp1.sum())
    mask_gdp2 = df["primary_energy_consumption"].isna() & df["energy_per_gdp"].notna() & df["gdp"].notna()
    df.loc[mask_gdp2, "primary_energy_consumption"] = df.loc[mask_gdp2, "energy_per_gdp"] * df.loc[mask_gdp2, "gdp"] / 1e9
    report("primary_energy_consumption (from energy_per_gdp)", mask_gdp2.sum())

    # Type 5 — Share of electricity
    print("\n--- Type 5: Share of electricity ---")
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
        mask1 = df[share_col].isna() & df[elec_col].notna() & df[gen_col].notna()
        df.loc[mask1, share_col] = df.loc[mask1, elec_col] / df.loc[mask1, gen_col] * 100
        report(f"{share_col} (from {elec_col})", mask1.sum())
        mask2 = df[elec_col].isna() & df[share_col].notna() & df[gen_col].notna()
        df.loc[mask2, elec_col] = df.loc[mask2, share_col] / 100 * df.loc[mask2, gen_col]
        report(f"{elec_col} (from {share_col})", mask2.sum())

    # Type 6 — Year-over-year change TWh
    print("\n--- Type 6: Change TWh (year-over-year) ---")
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

    # Type 7 — Change Pct
    print("\n--- Type 7: Change Pct ---")
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

    # Type 8 — Electricity demand identity
    print("\n--- Type 8: Electricity demand identity ---")
    for missing, a, b in [
        ("electricity_demand",      "electricity_generation", "net_elec_imports"),
        ("electricity_generation",  "electricity_demand",     "net_elec_imports"),
        ("net_elec_imports",        "electricity_demand",     "electricity_generation"),
    ]:
        mask = df[missing].isna() & df[a].notna() & df[b].notna()
        if missing == "electricity_demand":
            df.loc[mask, missing] = df.loc[mask, a] + df.loc[mask, b]
        else:
            df.loc[mask, missing] = df.loc[mask, a] - df.loc[mask, b]
        report(f"{missing} (demand identity)", mask.sum())
    mask_s1 = df["net_elec_imports_share_demand"].isna() & df["net_elec_imports"].notna() & df["electricity_demand"].notna()
    df.loc[mask_s1, "net_elec_imports_share_demand"] = df.loc[mask_s1, "net_elec_imports"] / df.loc[mask_s1, "electricity_demand"] * 100
    report("net_elec_imports_share_demand", mask_s1.sum())
    mask_s2 = df["net_elec_imports"].isna() & df["net_elec_imports_share_demand"].notna() & df["electricity_demand"].notna()
    df.loc[mask_s2, "net_elec_imports"] = df.loc[mask_s2, "net_elec_imports_share_demand"] / 100 * df.loc[mask_s2, "electricity_demand"]
    report("net_elec_imports (from share + demand)", mask_s2.sum())

    # Clean up any leaked helper columns
    helper_cols = [c for c in df.columns if c.startswith("_prev_")]
    if helper_cols:
        df.drop(columns=helper_cols, inplace=True)

    print(f"\nSTEP 3 TOTAL CELLS FILLED: {total_filled}")

    return df


# ===========================================================================
# STEP 4 — Tail-end extrapolation (2023–2024)
# ===========================================================================
def step4_extrapolate_tail(df):
    print("\n" + "=" * 60)
    print("STEP 4: Tail-end extrapolation (2023–2024)")
    print("=" * 60)

    COLS = ["electricity_demand", "electricity_generation", "fossil_electricity", "renewables_electricity"]
    VOLATILE_THRESH = 0.30
    MIN_LAST_KNOWN_YEAR = 2020

    df = df.sort_values(["country", "year"]).reset_index(drop=True)
    totals = {col: {"extrap": 0, "ffill": 0} for col in COLS}

    for col in COLS:
        for country, grp in df.groupby("country"):
            idx = grp.index.tolist()
            vals = grp[col].tolist()
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
            for i, v in zip(idx, vals):
                if pd.isna(v) and df.at[i, "year"] > last_year and df.at[i, "year"] in (2023, 2024):
                    steps = df.at[i, "year"] - last_year
                    if volatile:
                        df.at[i, col] = last_v
                        totals[col]["ffill"] += 1
                    else:
                        df.at[i, col] = last_v + slope * steps
                        totals[col]["extrap"] += 1

    print("Extrapolation summary:")
    for col in COLS:
        e, f = totals[col]["extrap"], totals[col]["ffill"]
        print(f"  {col}: {e} extrapolated, {f} forward-filled  (total {e+f})")

    return df


# ===========================================================================
# STEP 5 — Build model dataset (28 countries, 2000–2023, 17 core columns)
# ===========================================================================
def step5_build_model_dataset(df):
    print("\n" + "=" * 60)
    print("STEP 5: Build model dataset")
    print("=" * 60)

    COUNTRIES = [
        # Original 9
        "Croatia", "Estonia", "Latvia", "Lithuania", "Montenegro",
        "North Macedonia", "Palestine", "Slovenia", "Ukraine",
        # Major economies
        "United States", "China", "India", "Germany", "Brazil",
        "United Kingdom", "France", "Japan", "South Korea", "Indonesia",
        "South Africa", "Mexico", "Australia", "Canada", "Saudi Arabia",
        "Turkey", "Argentina", "Poland", "Egypt",
    ]

    COLUMNS = [
        "country", "year", "population", "gdp",
        "electricity_demand", "electricity_generation",
        "fossil_electricity", "renewables_electricity", "nuclear_electricity",
        "coal_electricity", "gas_electricity", "oil_electricity",
        "solar_electricity", "wind_electricity", "hydro_electricity",
        "primary_energy_consumption", "greenhouse_gas_emissions", "carbon_intensity_elec",
    ]

    df = df[df["country"].isin(COUNTRIES) & df["year"].between(2000, 2023)].copy()
    df = df[COLUMNS].sort_values(["country", "year"]).reset_index(drop=True)

    # Palestine 2023 — derive electricity components from constraints
    pal23 = (df["country"] == "Palestine") & (df["year"] == 2023)
    df.loc[pal23, "coal_electricity"]    = 0.0
    df.loc[pal23, "gas_electricity"]     = 0.0
    df.loc[pal23, "wind_electricity"]    = 0.0
    df.loc[pal23, "hydro_electricity"]   = 0.0
    df.loc[pal23, "nuclear_electricity"] = 0.0
    df.loc[pal23, "oil_electricity"]     = df.loc[pal23, "fossil_electricity"]
    df.loc[pal23, "solar_electricity"]   = df.loc[pal23, "renewables_electricity"]

    # Montenegro — data starts 2006; back-fill primary_energy_consumption for 2005
    mont = df["country"] == "Montenegro"
    df.loc[mont, "primary_energy_consumption"] = (
        df.loc[mont, "primary_energy_consumption"].bfill()
    )

    # GDP 2023 missing for all countries — extrapolate (linear slope from last 2 known years)
    # Exception: Ukraine — war-year slope is unreliable; forward-fill from 2022 instead
    FFILL_GDP = {"Ukraine"}
    for country, grp in df.groupby("country"):
        idx = grp.index
        gdp_vals = grp["gdp"].values
        known = [i for i, v in zip(idx, gdp_vals) if pd.notna(v)]
        if len(known) < 2:
            continue
        last_i, prev_i = known[-1], known[-2]
        last_year = df.at[last_i, "year"]
        for i in idx:
            if pd.isna(df.at[i, "gdp"]) and df.at[i, "year"] > last_year:
                if country in FFILL_GDP:
                    df.at[i, "gdp"] = df.at[last_i, "gdp"]
                else:
                    slope = df.at[last_i, "gdp"] - df.at[prev_i, "gdp"]
                    df.at[i, "gdp"] = df.at[last_i, "gdp"] + slope * (df.at[i, "year"] - last_year)

    # greenhouse_gas_emissions — forward-fill per country
    for country, grp in df.groupby("country"):
        idx = grp.index
        df.loc[idx, "greenhouse_gas_emissions"] = df.loc[idx, "greenhouse_gas_emissions"].ffill()

    # carbon_intensity_elec — forward-fill per country
    for country, grp in df.groupby("country"):
        idx = grp.index
        df.loc[idx, "carbon_intensity_elec"] = df.loc[idx, "carbon_intensity_elec"].ffill()

    print(f"Shape: {df.shape}")
    print(f"Countries: {df['country'].nunique()}  |  Years: {df['year'].nunique()}  ({df['year'].min()}–{df['year'].max()})")

    missing = df.isnull().sum()
    missing = missing[missing > 0]
    if len(missing) == 0:
        print("Missing values: none")
    else:
        print("Remaining missing values:")
        print(missing.to_string())

    print("\nSpot check (electricity_demand TWh):")
    spot = df[df["country"].isin(["United States", "China", "India"])][["country", "year", "electricity_demand"]]
    print(spot[spot["year"].isin([2000, 2010, 2020, 2023])].to_string(index=False))

    return df


# ===========================================================================
# MAIN PIPELINE
# ===========================================================================
if __name__ == "__main__":
    print(f"Reading source: {INPUT_FILE}")
    df = pd.read_csv(INPUT_FILE)

    df = step1_impute_fossil(df)
    df = step2_impute_renewables(df)
    df = step3_impute_all_patterns(df)
    df = step4_extrapolate_tail(df)

    df.to_csv(CLEANED_FILE, index=False)
    print(f"\nSaved cleaned dataset to: {CLEANED_FILE}")

    df_model = step5_build_model_dataset(df)

    os.makedirs("data", exist_ok=True)
    df_model.to_csv(MODEL_FILE, index=False)
    print(f"\nSaved model dataset to: {MODEL_FILE}")

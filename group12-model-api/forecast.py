import os
import json
import numpy as np
import pandas as pd
import joblib

# ── Load trained model and scaler ────────────────────────────────────────────
MODEL_DIR = os.path.dirname(__file__)
model  = joblib.load(os.path.join(MODEL_DIR, 'model.pkl'))
scaler = joblib.load(os.path.join(MODEL_DIR, 'scaler.pkl'))

# ── Constants (must match training notebook exactly) ─────────────────────────
TARGET       = 'electricity_demand'
LAGS         = [1, 2, 3]
FEATURE_COLS = [
    'demand_lag1', 'demand_lag2', 'demand_lag3',
    'demand_yoy_change', 'log_gdp', 'log_population', 'log_gdp_per_capita'
]

FORECAST_HORIZON  = 20
DAMPING_FACTOR    = 0.80
FLOOR_PERCENTILE  = 10
EXOG_TREND_YEARS  = 5

GDP_CAGR_MIN, GDP_CAGR_MAX = -0.05,  0.10
POP_CAGR_MIN, POP_CAGR_MAX = -0.02,  0.04

# ── Generation column groups ──────────────────────────────────────────────────
AGGREGATE_COLS       = ['fossil_electricity', 'renewables_electricity', 'nuclear_electricity']
FOSSIL_COMPONENTS    = ['gas_electricity', 'coal_electricity', 'oil_electricity']
RENEWABLES_COMPONENTS = ['hydro_electricity', 'solar_electricity', 'wind_electricity', 'biofuel_electricity']
ALL_GEN_COLS = (
    ['electricity_generation']
    + AGGREGATE_COLS
    + FOSSIL_COMPONENTS
    + RENEWABLES_COMPONENTS
    + ['greenhouse_gas_emissions']
)

EXPORT_FEATURES = [
    'gdp', 'population',
    'electricity_generation', 'fossil_electricity', 'gas_electricity',
    'coal_electricity', 'oil_electricity', 'renewables_electricity',
    'hydro_electricity', 'nuclear_electricity', 'solar_electricity',
    'wind_electricity', 'biofuel_electricity', 'greenhouse_gas_emissions',
]

# ── Data loading & feature engineering ───────────────────────────────────────
def load_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df.sort_values(['country', 'year']).reset_index(drop=True)

    for lag in LAGS:
        df[f'demand_lag{lag}'] = df.groupby('country')[TARGET].shift(lag)

    df['demand_yoy_change']  = df.groupby('country')[TARGET].diff().shift(1)
    df['gdp_per_capita']     = df['gdp'] / df['population']
    df['log_gdp']            = np.log1p(df['gdp'])
    df['log_population']     = np.log1p(df['population'])
    df['log_gdp_per_capita'] = np.log1p(df['gdp_per_capita'])

    return df

# ── CAGR helpers ──────────────────────────────────────────────────────────────
def cagr_extrapolate(series, years_back, horizon, cagr_min=None, cagr_max=None):
    """
    Project a series forward via CAGR with spike detection and optional bounds.
    Copied exactly from notebook cell 15.
    """
    full = series.dropna()
    tail = full.iloc[-years_back:]
    tail = tail[tail > 0]
    if len(tail) < 2:
        return [float(full.iloc[-1])] * horizon

    last, prev = float(tail.iloc[-1]), float(tail.iloc[-2])
    if prev > 0 and last / prev > 1.4:
        # Anomalous spike — use pre-spike tail as anchor
        clean_tail = tail.iloc[:-1]
        anchor = float(clean_tail.iloc[-1])
        rate = (
            (clean_tail.iloc[-1] / clean_tail.iloc[0]) ** (1 / (len(clean_tail) - 1)) - 1
            if len(clean_tail) >= 2 else 0.02
        )
    else:
        anchor = last
        rate   = (tail.iloc[-1] / tail.iloc[0]) ** (1 / (len(tail) - 1)) - 1

    if cagr_min is not None:
        rate = max(rate, cagr_min)
    if cagr_max is not None:
        rate = min(rate, cagr_max)

    return [anchor * (1 + rate) ** t for t in range(1, horizon + 1)]


def cagr_project_bounded(series, years_back, horizon, cagr_min=-0.15, cagr_max=0.20):
    """Bounded CAGR projection for generation mix components. From notebook cell 16."""
    tail = series.dropna().iloc[-years_back:]
    tail = tail[tail > 0]
    if len(tail) < 2:
        last = float(series.dropna().iloc[-1]) if len(series.dropna()) > 0 else 0.0
        return [last] * horizon
    rate = (tail.iloc[-1] / tail.iloc[0]) ** (1 / (len(tail) - 1)) - 1
    rate = max(min(rate, cagr_max), cagr_min)
    last = float(tail.iloc[-1])
    return [last * (1 + rate) ** t for t in range(1, horizon + 1)]


def smooth_transition(last_actual, projected_series, n_smooth=3):
    """
    Blend the first n_smooth forecast years toward the last actual value.
    From notebook cell 16.
    """
    smoothed = list(projected_series)
    weights  = [0.75, 0.50, 0.25]
    for i in range(min(n_smooth, len(smoothed))):
        w = weights[i]
        smoothed[i] = w * last_actual + (1 - w) * projected_series[i]
    return smoothed

# ── Generation mix forecast ───────────────────────────────────────────────────
def forecast_gen_mix(cdf, demand_forecast, horizon, trend_years):
    """
    Returns dict of {feature: [horizon values]} for all generation columns.
    Copied exactly from notebook cell 16.
    """
    result = {}

    # Step 1: total generation anchored to demand via last known gen/demand ratio
    last_demand      = float(cdf['electricity_demand'].dropna().iloc[-1])
    last_gen         = float(cdf['electricity_generation'].dropna().iloc[-1])
    gen_demand_ratio = last_gen / last_demand if last_demand > 0 else 1.0
    projected_gen    = [d * gen_demand_ratio for d in demand_forecast]
    result['electricity_generation'] = projected_gen

    # Step 2: aggregate sources with smooth transition, rescaled to sum to projected_gen
    raw_agg = {}
    for col in AGGREGATE_COLS:
        last_actual  = float(cdf[col].dropna().iloc[-1])
        raw_proj     = cagr_project_bounded(cdf[col], trend_years, horizon)
        raw_agg[col] = smooth_transition(last_actual, raw_proj, n_smooth=3)

    for t in range(horizon):
        agg_total = sum(raw_agg[col][t] for col in AGGREGATE_COLS)
        scale     = projected_gen[t] / agg_total if agg_total > 0 else 1.0
        for col in AGGREGATE_COLS:
            if col not in result:
                result[col] = []
            result[col].append(raw_agg[col][t] * scale)

    # Step 3: granular sub-components derived from aggregate shares
    def project_component_shares(components, parent_series, years_back, horizon):
        parent_tail = parent_series.dropna().iloc[-years_back:]
        shares = {}
        for col in components:
            comp_tail   = cdf[col].dropna().iloc[-years_back:]
            hist_shares = []
            for i in range(min(len(comp_tail), len(parent_tail))):
                p = float(parent_tail.iloc[-(len(comp_tail) - i)])
                c = float(comp_tail.iloc[i])
                hist_shares.append(c / p if p > 0 else 0.0)

            non_zero = [s for s in hist_shares if s > 0]
            if len(non_zero) >= 2:
                share_rate  = (non_zero[-1] / non_zero[0]) ** (1 / (len(non_zero) - 1)) - 1
                share_rate  = max(min(share_rate, 0.15), -0.10)
                last_share  = hist_shares[-1]
            elif len(non_zero) == 1:
                share_rate = 0.0
                last_share = non_zero[-1]
            else:
                share_rate = 0.0
                last_share = 0.0

            shares[col] = [last_share * (1 + share_rate) ** t for t in range(1, horizon + 1)]

        # Normalise shares to sum to 1 each year
        for t in range(horizon):
            total_share = sum(shares[col][t] for col in components)
            if total_share > 0:
                for col in components:
                    shares[col][t] /= total_share

        return shares

    fossil_shares     = project_component_shares(
        FOSSIL_COMPONENTS, cdf['fossil_electricity'], trend_years, horizon
    )
    renewables_shares = project_component_shares(
        RENEWABLES_COMPONENTS, cdf['renewables_electricity'], trend_years, horizon
    )

    for t in range(horizon):
        for col in FOSSIL_COMPONENTS:
            if col not in result:
                result[col] = []
            result[col].append(result['fossil_electricity'][t] * fossil_shares[col][t])
        for col in RENEWABLES_COMPONENTS:
            if col not in result:
                result[col] = []
            result[col].append(result['renewables_electricity'][t] * renewables_shares[col][t])

    # Step 4: greenhouse_gas_emissions via independent bounded CAGR
    last_ghg = float(cdf['greenhouse_gas_emissions'].dropna().iloc[-1])
    raw_ghg  = cagr_project_bounded(
        cdf['greenhouse_gas_emissions'], trend_years, horizon,
        cagr_min=-0.10, cagr_max=0.10
    )
    result['greenhouse_gas_emissions'] = smooth_transition(last_ghg, raw_ghg, n_smooth=3)

    return result

# ── Safe type helpers ─────────────────────────────────────────────────────────
def safe_float(val):
    try:
        v = float(val)
        return None if (v != v) else round(v, 4)   # NaN check
    except (TypeError, ValueError):
        return None

def safe_int(val):
    try:
        v = float(val)
        return None if (v != v) else int(round(v))
    except (TypeError, ValueError):
        return None

# ── Per-country forecast builder ──────────────────────────────────────────────
def build_forecast(df: pd.DataFrame, country: str) -> list:
    """
    Build the full historical + forecast record list for one country.
    Implements the export loop from notebook cell 17.
    Returns a list of dicts (one per year) or empty list if insufficient data.
    """
    cdf   = df[df['country'] == country].sort_values('year').copy()
    known = cdf[TARGET].dropna()

    if len(known) < 3:
        return []

    LAST_DATA_YEAR = int(df['year'].max())
    hist_floor     = max(float(np.percentile(known.values, FLOOR_PERCENTILE)), 0.0)

    # Seeds — preserved separately so the export loop can start fresh
    lag1_seed = float(known.iloc[-1])
    lag2_seed = float(known.iloc[-2]) if len(known) >= 2 else lag1_seed
    lag3_seed = float(known.iloc[-3]) if len(known) >= 3 else lag2_seed
    yoy_seed  = lag1_seed - lag2_seed

    future_gdp = cagr_extrapolate(
        cdf['gdp'], EXOG_TREND_YEARS, FORECAST_HORIZON,
        cagr_min=GDP_CAGR_MIN, cagr_max=GDP_CAGR_MAX
    )
    future_pop = cagr_extrapolate(
        cdf['population'], EXOG_TREND_YEARS, FORECAST_HORIZON,
        cagr_min=POP_CAGR_MIN, cagr_max=POP_CAGR_MAX
    )
    future_years = list(range(LAST_DATA_YEAR + 1, LAST_DATA_YEAR + FORECAST_HORIZON + 1))

    # Historical growth constraints (same as notebook cell 15 & 17)
    hist_changes    = known.diff().dropna().abs()
    max_abs_change  = float(hist_changes.max()) * 1.5 if len(hist_changes) > 0 else float('inf')
    hist_cagr       = 0.0
    if len(known) >= 5 and float(known.iloc[0]) > 0:
        hist_cagr = (known.iloc[-1] / known.iloc[0]) ** (1 / (len(known) - 1)) - 1
    max_pct_growth  = max(hist_cagr * 1.5, 0.02)

    # Pre-compute demand forecast for generation mix anchoring
    lag1_pre, lag2_pre, lag3_pre, yoy_pre = lag1_seed, lag2_seed, lag3_seed, yoy_seed
    demand_forecast = []
    for t in range(FORECAST_HORIZON):
        gdp_val    = future_gdp[t]
        pop_val    = future_pop[t]
        gdp_pc_val = gdp_val / pop_val if pop_val > 0 else 0
        X_tmp = pd.DataFrame([{
            'demand_lag1': lag1_pre, 'demand_lag2': lag2_pre, 'demand_lag3': lag3_pre,
            'demand_yoy_change': yoy_pre,
            'log_gdp': np.log1p(gdp_val), 'log_population': np.log1p(pop_val),
            'log_gdp_per_capita': np.log1p(gdp_pc_val),
        }])
        pred_tmp = float(model.predict(scaler.transform(X_tmp))[0])
        pred_tmp = max(pred_tmp, hist_floor)
        pred_tmp = min(pred_tmp, lag1_pre + max_abs_change, lag1_pre * (1 + max_pct_growth))
        pred_tmp = max(pred_tmp, hist_floor)
        demand_forecast.append(pred_tmp)
        yoy_pre  = (pred_tmp - lag1_pre) * (DAMPING_FACTOR ** (t + 1))
        lag3_pre, lag2_pre, lag1_pre = lag2_pre, lag1_pre, pred_tmp

    # Forecast generation mix
    gen_mix = forecast_gen_mix(cdf, demand_forecast, FORECAST_HORIZON, EXOG_TREND_YEARS)

    records = []

    # Historical records
    for _, row in cdf.iterrows():
        d = row[TARGET]
        if pd.isna(d):
            continue
        record = {
            'year':       int(row['year']),
            'demand':     safe_float(d),
            'type':       'historical',
            'gdp':        safe_float(row['gdp']),
            'population': safe_float(row['population']),
        }
        for feat in EXPORT_FEATURES:
            if feat in ('gdp', 'population'):
                continue
            record[feat] = safe_float(row[feat]) if feat in row.index else None
        records.append(record)

    # Forecast records — restart from original seeds
    lag1, lag2, lag3, yoy = lag1_seed, lag2_seed, lag3_seed, yoy_seed

    for t in range(FORECAST_HORIZON):
        gdp_val    = future_gdp[t]
        pop_val    = future_pop[t]
        gdp_pc_val = gdp_val / pop_val if pop_val > 0 else 0

        X_step = pd.DataFrame([{
            'demand_lag1': lag1, 'demand_lag2': lag2, 'demand_lag3': lag3,
            'demand_yoy_change': yoy,
            'log_gdp': np.log1p(gdp_val), 'log_population': np.log1p(pop_val),
            'log_gdp_per_capita': np.log1p(gdp_pc_val),
        }])

        pred = float(model.predict(scaler.transform(X_step))[0])
        pred = max(pred, hist_floor)
        pred = min(pred, lag1 + max_abs_change, lag1 * (1 + max_pct_growth))
        pred = max(pred, hist_floor)

        record = {
            'year':       int(future_years[t]),
            'demand':     round(pred, 4),
            'type':       'forecast',
            'gdp':        round(float(gdp_val), 2),
            'population': safe_int(pop_val),
        }
        for feat in ALL_GEN_COLS:
            val = gen_mix.get(feat, [None] * FORECAST_HORIZON)[t]
            record[feat] = round(float(val), 4) if val is not None else None

        records.append(record)

        yoy  = (pred - lag1) * (DAMPING_FACTOR ** (t + 1))
        lag3, lag2, lag1 = lag2, lag1, pred

    return sorted(records, key=lambda r: r['year'])


# ── Run all countries ─────────────────────────────────────────────────────────
def run_all_countries(df: pd.DataFrame) -> dict:
    """Build forecast for every country in the dataset."""
    output   = {}
    skipped  = []
    for country in sorted(df['country'].unique()):
        records = build_forecast(df, country)
        if records:
            output[country] = records
        else:
            skipped.append(country)
    print(f"Forecast complete: {len(output)} countries built, {len(skipped)} skipped.")
    return output
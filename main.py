"""
Electricity Demand Forecast API
================================
FastAPI deployment of the improved Ridge regression model.

Endpoints:
  GET  /                          – health check
  GET  /countries                 – list all available countries
  GET  /metrics                   – overall train/test RMSE and MAE
  GET  /forecast/{country}        – historical + 20-year forecast for one country
  GET  /forecast                  – forecast for a query-param list of countries
  POST /retrain                   – re-train the model from the CSV on disk

On startup the app trains the model and caches all forecasts in memory.
If a pre-saved model artefact exists (model_artefacts.joblib) it is loaded
instead of retraining, which is faster for cold-start in production.

Requirements (pip install):
  fastapi uvicorn[standard] scikit-learn pandas numpy joblib
"""

from __future__ import annotations

import json
import os
import logging
from contextlib import asynccontextmanager
from typing import Any

import joblib
import numpy as np
import pandas as pd
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import RobustScaler

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
DATA_PATH      = os.path.join(BASE_DIR, "df_clean.csv")
ARTEFACT_PATH  = os.path.join(BASE_DIR, "model_artefacts.joblib")

# ---------------------------------------------------------------------------
# Model / forecast configuration  (mirrors the notebook exactly)
# ---------------------------------------------------------------------------
TARGET        = "electricity_demand"
LAGS          = [1, 2, 3]
FEATURE_COLS  = [
    "demand_lag1", "demand_lag2", "demand_lag3",
    "demand_yoy_change", "log_gdp", "log_population", "log_gdp_per_capita",
]
TRAIN_END     = 2019
TEST_START    = 2020
RIDGE_ALPHA   = 1.0

FORECAST_HORIZON  = 20
EXOG_TREND_YEARS  = 5
DAMPING_FACTOR    = 0.80
FLOOR_PERCENTILE  = 10

GDP_CAGR_MIN  = -0.05
GDP_CAGR_MAX  =  0.10
POP_CAGR_MIN  = -0.02
POP_CAGR_MAX  =  0.04

AGGREGATE_COLS       = ["fossil_electricity", "renewables_electricity", "nuclear_electricity"]
FOSSIL_COMPONENTS    = ["gas_electricity", "coal_electricity", "oil_electricity"]
RENEWABLES_COMPONENTS = ["hydro_electricity", "solar_electricity", "wind_electricity", "biofuel_electricity"]
ALL_GEN_COLS = (
    ["electricity_generation"]
    + AGGREGATE_COLS
    + FOSSIL_COMPONENTS
    + RENEWABLES_COMPONENTS
    + ["greenhouse_gas_emissions"]
)
EXPORT_FEATURES = [
    "gdp", "population",
    "electricity_generation", "fossil_electricity", "gas_electricity",
    "coal_electricity", "oil_electricity", "renewables_electricity",
    "hydro_electricity", "nuclear_electricity", "solar_electricity",
    "wind_electricity", "biofuel_electricity", "greenhouse_gas_emissions",
]

# ---------------------------------------------------------------------------
# In-memory state (populated on startup)
# ---------------------------------------------------------------------------
STATE: dict[str, Any] = {
    "model":           None,
    "scaler":          None,
    "df_model":        None,
    "train_metrics":   None,
    "test_metrics":    None,
    "forecast_cache":  {},
    "last_data_year":  None,
}

# ===========================================================================
# Feature engineering helpers
# ===========================================================================

def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["country", "year"]).reset_index(drop=True)
    for lag in LAGS:
        df[f"demand_lag{lag}"] = df.groupby("country")[TARGET].shift(lag)
    df["demand_yoy_change"]  = df.groupby("country")[TARGET].diff().shift(1)
    df["gdp_per_capita"]     = df["gdp"] / df["population"]
    df["log_gdp"]            = np.log1p(df["gdp"])
    df["log_population"]     = np.log1p(df["population"])
    df["log_gdp_per_capita"] = np.log1p(df["gdp_per_capita"])
    return df


# ===========================================================================
# CAGR / projection helpers 
# ===========================================================================

def _cagr_extrapolate(
    series: pd.Series,
    years_back: int,
    horizon: int,
    cagr_min: float | None = None,
    cagr_max: float | None = None,
) -> list[float]:
    full = series.dropna()
    tail = full.iloc[-years_back:]
    tail = tail[tail > 0]
    if len(tail) < 2:
        return [float(full.iloc[-1])] * horizon
    last, prev = float(tail.iloc[-1]), float(tail.iloc[-2])
    if prev > 0 and last / prev > 1.4:
        clean_tail = tail.iloc[:-1]
        anchor = float(clean_tail.iloc[-1])
        rate = (
            (clean_tail.iloc[-1] / clean_tail.iloc[0]) ** (1 / (len(clean_tail) - 1)) - 1
            if len(clean_tail) >= 2
            else 0.02
        )
    else:
        anchor = last
        rate = (tail.iloc[-1] / tail.iloc[0]) ** (1 / (len(tail) - 1)) - 1
    if cagr_min is not None:
        rate = max(rate, cagr_min)
    if cagr_max is not None:
        rate = min(rate, cagr_max)
    return [anchor * (1 + rate) ** t for t in range(1, horizon + 1)]


def _cagr_project_bounded(
    series: pd.Series,
    years_back: int,
    horizon: int,
    cagr_min: float = -0.15,
    cagr_max: float = 0.20,
) -> list[float]:
    tail = series.dropna().iloc[-years_back:]
    tail = tail[tail > 0]
    if len(tail) < 2:
        last = float(series.dropna().iloc[-1]) if len(series.dropna()) > 0 else 0.0
        return [last] * horizon
    rate = (tail.iloc[-1] / tail.iloc[0]) ** (1 / (len(tail) - 1)) - 1
    rate = max(min(rate, cagr_max), cagr_min)
    last = float(tail.iloc[-1])
    return [last * (1 + rate) ** t for t in range(1, horizon + 1)]


def _smooth_transition(
    last_actual: float,
    projected_series: list[float],
    n_smooth: int = 3,
) -> list[float]:
    smoothed = list(projected_series)
    weights = [0.75, 0.50, 0.25]
    for i in range(min(n_smooth, len(smoothed))):
        smoothed[i] = weights[i] * last_actual + (1 - weights[i]) * projected_series[i]
    return smoothed


def _project_component_shares(
    components: list[str],
    cdf: pd.DataFrame,
    parent_series: pd.Series,
    years_back: int,
    horizon: int,
) -> dict[str, list[float]]:
    parent_tail = parent_series.dropna().iloc[-years_back:]
    shares: dict[str, list[float]] = {}
    for col in components:
        comp_tail = cdf[col].dropna().iloc[-years_back:]
        hist_shares = []
        for i in range(min(len(comp_tail), len(parent_tail))):
            p = float(parent_tail.iloc[-(len(comp_tail) - i)])
            c = float(comp_tail.iloc[i])
            hist_shares.append(c / p if p > 0 else 0.0)
        non_zero = [s for s in hist_shares if s > 0]
        if len(non_zero) >= 2:
            share_rate = (non_zero[-1] / non_zero[0]) ** (1 / (len(non_zero) - 1)) - 1
            share_rate = max(min(share_rate, 0.15), -0.10)
            last_share = hist_shares[-1]
        elif len(non_zero) == 1:
            share_rate  = 0.0
            last_share  = non_zero[-1]
        else:
            share_rate  = 0.0
            last_share  = 0.0
        shares[col] = [last_share * (1 + share_rate) ** t for t in range(1, horizon + 1)]
    for t in range(horizon):
        total_share = sum(shares[col][t] for col in components)
        if total_share > 0:
            for col in components:
                shares[col][t] /= total_share
    return shares


def _forecast_gen_mix(
    cdf: pd.DataFrame,
    demand_forecast: list[float],
    horizon: int,
    trend_years: int,
) -> dict[str, list[float]]:
    result: dict[str, list[float]] = {}

    last_demand = float(cdf[TARGET].dropna().iloc[-1])
    last_gen    = float(cdf["electricity_generation"].dropna().iloc[-1])
    gen_demand_ratio = last_gen / last_demand if last_demand > 0 else 1.0
    projected_gen = [d * gen_demand_ratio for d in demand_forecast]
    result["electricity_generation"] = projected_gen

    raw_agg: dict[str, list[float]] = {}
    for col in AGGREGATE_COLS:
        last_actual = float(cdf[col].dropna().iloc[-1])
        raw_proj    = _cagr_project_bounded(cdf[col], trend_years, horizon)
        raw_agg[col] = _smooth_transition(last_actual, raw_proj, n_smooth=3)

    for t in range(horizon):
        agg_total = sum(raw_agg[col][t] for col in AGGREGATE_COLS)
        scale = projected_gen[t] / agg_total if agg_total > 0 else 1.0
        for col in AGGREGATE_COLS:
            if col not in result:
                result[col] = []
            result[col].append(raw_agg[col][t] * scale)

    fossil_shares = _project_component_shares(
        FOSSIL_COMPONENTS, cdf, cdf["fossil_electricity"], trend_years, horizon
    )
    renewables_shares = _project_component_shares(
        RENEWABLES_COMPONENTS, cdf, cdf["renewables_electricity"], trend_years, horizon
    )
    for t in range(horizon):
        for col in FOSSIL_COMPONENTS:
            if col not in result:
                result[col] = []
            result[col].append(result["fossil_electricity"][t] * fossil_shares[col][t])
        for col in RENEWABLES_COMPONENTS:
            if col not in result:
                result[col] = []
            result[col].append(result["renewables_electricity"][t] * renewables_shares[col][t])

    last_ghg = float(cdf["greenhouse_gas_emissions"].dropna().iloc[-1])
    raw_ghg  = _cagr_project_bounded(
        cdf["greenhouse_gas_emissions"], trend_years, horizon, cagr_min=-0.10, cagr_max=0.10
    )
    result["greenhouse_gas_emissions"] = _smooth_transition(last_ghg, raw_ghg, n_smooth=3)

    return result


# ===========================================================================
# Serialisation helpers
# ===========================================================================

def _safe_float(val: Any) -> float | None:
    try:
        v = float(val)
        return None if v != v else round(v, 4)
    except (TypeError, ValueError):
        return None


def _safe_int(val: Any) -> int | None:
    try:
        v = float(val)
        return None if v != v else int(round(v))
    except (TypeError, ValueError):
        return None


# ===========================================================================
# Core training & forecasting logic
# ===========================================================================

def _train_model(df: pd.DataFrame) -> dict[str, Any]:
    """Train the Ridge model and return all artefacts."""
    df = _build_features(df)
    df_model = df.dropna(subset=FEATURE_COLS + [TARGET]).copy()

    train = df_model[df_model["year"] <= TRAIN_END]
    test  = df_model[df_model["year"] >= TEST_START]

    scaler = RobustScaler()
    X_train = scaler.fit_transform(train[FEATURE_COLS])
    X_test  = scaler.transform(test[FEATURE_COLS])

    y_train = train[TARGET]
    y_test  = test[TARGET]

    model = Ridge(alpha=RIDGE_ALPHA)
    model.fit(X_train, y_train)

    y_pred_train = model.predict(X_train)
    y_pred_test  = model.predict(X_test)

    train_metrics = {
        "rmse": round(float(np.sqrt(mean_squared_error(y_train, y_pred_train))), 4),
        "mae":  round(float(mean_absolute_error(y_train, y_pred_train)), 4),
    }
    test_metrics = {
        "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_pred_test))), 4),
        "mae":  round(float(mean_absolute_error(y_test, y_pred_test)), 4),
    }

    return {
        "model":         model,
        "scaler":        scaler,
        "df":            df,
        "df_model":      df_model,
        "train_metrics": train_metrics,
        "test_metrics":  test_metrics,
        "last_data_year": int(df["year"].max()),
    }


def _build_country_forecast(
    country: str,
    cdf: pd.DataFrame,
    model: Ridge,
    scaler: RobustScaler,
    last_data_year: int,
) -> list[dict]:
    """Return a list of year-records (historical + forecast) for one country."""
    known = cdf[TARGET].dropna()
    if len(known) < 3:
        return []

    hist_floor = max(float(np.percentile(known.values, FLOOR_PERCENTILE)), 0.0)

    lag1_seed = float(known.iloc[-1])
    lag2_seed = float(known.iloc[-2]) if len(known) >= 2 else lag1_seed
    lag3_seed = float(known.iloc[-3]) if len(known) >= 3 else lag2_seed
    yoy_seed  = lag1_seed - lag2_seed

    future_gdp = _cagr_extrapolate(
        cdf["gdp"], EXOG_TREND_YEARS, FORECAST_HORIZON,
        cagr_min=GDP_CAGR_MIN, cagr_max=GDP_CAGR_MAX,
    )
    future_pop = _cagr_extrapolate(
        cdf["population"], EXOG_TREND_YEARS, FORECAST_HORIZON,
        cagr_min=POP_CAGR_MIN, cagr_max=POP_CAGR_MAX,
    )
    future_years = list(range(last_data_year + 1, last_data_year + FORECAST_HORIZON + 1))

    hist_changes = known.diff().dropna().abs()
    max_abs_change = float(hist_changes.max()) * 1.5 if len(hist_changes) > 0 else float("inf")
    hist_cagr = 0.0
    if len(known) >= 5 and float(known.iloc[0]) > 0:
        hist_cagr = (known.iloc[-1] / known.iloc[0]) ** (1 / (len(known) - 1)) - 1
    max_pct_growth = max(hist_cagr * 1.5, 0.02)

    # Pre-compute demand forecast for gen-mix helper
    lag1, lag2, lag3, yoy = lag1_seed, lag2_seed, lag3_seed, yoy_seed
    demand_forecast: list[float] = []
    for t in range(FORECAST_HORIZON):
        gdp_val    = future_gdp[t]
        pop_val    = future_pop[t]
        gdp_pc_val = gdp_val / pop_val if pop_val > 0 else 0
        X_tmp = pd.DataFrame([{
            "demand_lag1": lag1, "demand_lag2": lag2, "demand_lag3": lag3,
            "demand_yoy_change": yoy,
            "log_gdp": np.log1p(gdp_val), "log_population": np.log1p(pop_val),
            "log_gdp_per_capita": np.log1p(gdp_pc_val),
        }])
        pred = float(model.predict(scaler.transform(X_tmp))[0])
        pred = max(pred, hist_floor)
        pred = min(pred, lag1 + max_abs_change, lag1 * (1 + max_pct_growth))
        pred = max(pred, hist_floor)
        demand_forecast.append(pred)
        yoy   = (pred - lag1) * (DAMPING_FACTOR ** (t + 1))
        lag3, lag2, lag1 = lag2, lag1, pred

    gen_mix = _forecast_gen_mix(cdf, demand_forecast, FORECAST_HORIZON, EXOG_TREND_YEARS)

    records: list[dict] = []

    # Historical records
    for _, row in cdf.iterrows():
        d = row[TARGET]
        if pd.isna(d):
            continue
        record: dict = {
            "year":       int(row["year"]),
            "demand":     _safe_float(d),
            "type":       "historical",
            "gdp":        _safe_float(row["gdp"]),
            "population": _safe_float(row["population"]),
        }
        for feat in EXPORT_FEATURES:
            if feat in ("gdp", "population"):
                continue
            record[feat] = _safe_float(row[feat]) if feat in row.index else None
        records.append(record)

    # Forecast records
    lag1, lag2, lag3, yoy = lag1_seed, lag2_seed, lag3_seed, yoy_seed
    for t in range(FORECAST_HORIZON):
        gdp_val    = future_gdp[t]
        pop_val    = future_pop[t]
        gdp_pc_val = gdp_val / pop_val if pop_val > 0 else 0
        X_step = pd.DataFrame([{
            "demand_lag1": lag1, "demand_lag2": lag2, "demand_lag3": lag3,
            "demand_yoy_change": yoy,
            "log_gdp": np.log1p(gdp_val), "log_population": np.log1p(pop_val),
            "log_gdp_per_capita": np.log1p(gdp_pc_val),
        }])
        pred = float(model.predict(scaler.transform(X_step))[0])
        pred = max(pred, hist_floor)
        pred = min(pred, lag1 + max_abs_change, lag1 * (1 + max_pct_growth))
        pred = max(pred, hist_floor)

        record = {
            "year":       int(future_years[t]),
            "demand":     round(pred, 4),
            "type":       "forecast",
            "gdp":        round(float(gdp_val), 2),
            "population": _safe_int(pop_val),
        }
        for feat in ALL_GEN_COLS:
            val = gen_mix.get(feat, [None] * FORECAST_HORIZON)[t]
            record[feat] = round(float(val), 4) if val is not None else None
        records.append(record)

        yoy   = (pred - lag1) * (DAMPING_FACTOR ** (t + 1))
        lag3, lag2, lag1 = lag2, lag1, pred

    return sorted(records, key=lambda r: r["year"])


def _initialise_state(df: pd.DataFrame, artefacts: dict) -> None:
    """Populate global STATE from trained artefacts."""
    model        = artefacts["model"]
    scaler       = artefacts["scaler"]
    df_full      = artefacts["df"]
    last_year    = artefacts["last_data_year"]

    STATE["model"]         = model
    STATE["scaler"]        = scaler
    STATE["df_model"]      = artefacts["df_model"]
    STATE["train_metrics"] = artefacts["train_metrics"]
    STATE["test_metrics"]  = artefacts["test_metrics"]
    STATE["last_data_year"] = last_year

    log.info("Building forecast cache for all countries …")
    cache: dict[str, list[dict]] = {}
    skipped = []
    for country in sorted(df_full["country"].unique()):
        cdf = df_full[df_full["country"] == country].sort_values("year").copy()
        records = _build_country_forecast(country, cdf, model, scaler, last_year)
        if records:
            cache[country] = records
        else:
            skipped.append(country)
    STATE["forecast_cache"] = cache
    log.info(
        "Forecast cache ready: %d countries  |  skipped: %d",
        len(cache), len(skipped),
    )


# ===========================================================================
# FastAPI lifespan — load or train on startup
# ===========================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.path.exists(ARTEFACT_PATH):
        log.info("Loading saved model artefacts from %s", ARTEFACT_PATH)
        saved = joblib.load(ARTEFACT_PATH)
        df    = pd.read_csv(DATA_PATH)
        df    = _build_features(df)
        _initialise_state(df, saved)
    else:
        log.info("No artefact file found — training model from %s", DATA_PATH)
        df        = pd.read_csv(DATA_PATH)
        artefacts = _train_model(df)
        joblib.dump(
            {k: v for k, v in artefacts.items() if k != "df"},
            ARTEFACT_PATH,
        )
        log.info("Artefacts saved to %s", ARTEFACT_PATH)
        _initialise_state(df, artefacts)
    yield
    # shutdown — nothing to tear down


# ===========================================================================
# FastAPI app
# ===========================================================================

app = FastAPI(
    title="Electricity Demand Forecast API",
    description=(
        "Ridge regression model (L2, RobustScaler, log-transformed GDP/population) "
        "trained on national electricity-demand data. "
        "Provides 20-year demand forecasts with generation-mix breakdown."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------

class MetricsResponse(BaseModel):
    train: dict[str, float]
    test:  dict[str, float]


class CountriesResponse(BaseModel):
    count:     int
    countries: list[str]


class RetrainResponse(BaseModel):
    status:  str
    train:   dict[str, float]
    test:    dict[str, float]
    message: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/", tags=["health"])
def health_check():
    """Basic health check."""
    return {
        "status":        "ok",
        "model":         "Ridge regression (improved)",
        "countries_cached": len(STATE["forecast_cache"]),
        "last_data_year": STATE["last_data_year"],
    }


@app.get("/countries", response_model=CountriesResponse, tags=["data"])
def list_countries():
    """Return all countries for which forecasts are available."""
    countries = sorted(STATE["forecast_cache"].keys())
    return {"count": len(countries), "countries": countries}


@app.get("/metrics", response_model=MetricsResponse, tags=["model"])
def get_metrics():
    """Return overall train / test RMSE and MAE (TWh)."""
    if STATE["train_metrics"] is None:
        raise HTTPException(status_code=503, detail="Model not initialised yet.")
    return {"train": STATE["train_metrics"], "test": STATE["test_metrics"]}


@app.get("/forecast/{country}", tags=["forecast"])
def forecast_country(country: str):
    """
    Return historical actuals plus 20-year demand + generation-mix forecast
    for a single country.

    Country names are case-sensitive and must match the dataset exactly
    (e.g. "United States", "India", "Germany").
    """
    cache: dict = STATE["forecast_cache"]
    if not cache:
        raise HTTPException(status_code=503, detail="Forecast cache not ready.")

    if country not in cache:
        # Try case-insensitive fallback
        lower_map = {k.lower(): k for k in cache}
        matched = lower_map.get(country.lower())
        if matched is None:
            raise HTTPException(
                status_code=404,
                detail=f"Country '{country}' not found. Use GET /countries for the full list.",
            )
        country = matched

    return JSONResponse(content={"country": country, "records": cache[country]})


@app.get("/forecast", tags=["forecast"])
def forecast_multiple(
    countries: list[str] = Query(
        ...,
        description="One or more country names, e.g. ?countries=India&countries=Germany",
    )
):
    """
    Return forecasts for multiple countries in one request.
    Duplicate or missing countries are silently reported in `not_found`.
    """
    cache: dict = STATE["forecast_cache"]
    lower_map   = {k.lower(): k for k in cache}

    found:     dict[str, list[dict]] = {}
    not_found: list[str]             = []

    for name in countries:
        canonical = cache.get(name) and name or lower_map.get(name.lower())
        if canonical:
            found[canonical] = cache[canonical]
        else:
            not_found.append(name)

    return JSONResponse(
        content={
            "forecasts":  found,
            "not_found":  not_found,
        }
    )


@app.post("/retrain", response_model=RetrainResponse, tags=["model"])
def retrain():
    """
    Re-read the CSV from disk, retrain the model, rebuild the forecast cache,
    and overwrite the saved artefacts. This is a blocking call.
    """
    if not os.path.exists(DATA_PATH):
        raise HTTPException(status_code=404, detail=f"Data file not found: {DATA_PATH}")

    log.info("Retraining requested …")
    df        = pd.read_csv(DATA_PATH)
    artefacts = _train_model(df)

    joblib.dump(
        {k: v for k, v in artefacts.items() if k != "df"},
        ARTEFACT_PATH,
    )
    _initialise_state(df, artefacts)
    log.info("Retraining complete.")

    return {
        "status":  "ok",
        "train":   artefacts["train_metrics"],
        "test":    artefacts["test_metrics"],
        "message": f"Model retrained. Forecast cache updated for {len(STATE['forecast_cache'])} countries.",
    }


# ===========================================================================
# Entry point
# ===========================================================================

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

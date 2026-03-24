import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from forecast import load_data, run_all_countries

# ── Paths ─────────────────────────────────────────────────────────────────────
API_DIR   = os.path.dirname(__file__)
DATA_PATH = os.path.join(API_DIR, 'df_clean.csv')

# ── Startup: run the full forecast once and cache it ─────────────────────────
# This mirrors exactly what the notebook does — build the complete JSON for
# all countries on startup, then serve it from memory on every request.
# No re-computation per request — fast responses, consistent data.
cache: dict = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading dataset...")
    df = load_data(DATA_PATH)
    print(f"Dataset loaded: {df['country'].nunique()} countries, years {int(df['year'].min())}–{int(df['year'].max())}")

    print("Running forecasts for all countries...")
    cache['forecast'] = run_all_countries(df)
    print(f"Ready. {len(cache['forecast'])} countries forecasted.")
    yield
    cache.clear()

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Group 12 — Electricity Demand Forecast API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # restrict to your frontend domain in production
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/forecast")
def get_all_forecast():
    """
    Returns the complete forecast for all countries in one response.
    This is the single endpoint your frontend calls.

    Response shape:
    {
      "United States": [ { year, demand, type, gdp, population, ... }, ... ],
      "Kenya":         [ ... ],
      ...                           (181 countries total)
    }
    """
    return cache["forecast"]


@app.get("/forecast/{country}")
def get_country_forecast(country: str):
    """
    Returns the forecast for a single country by name.
    Useful for debugging or if you want to fetch one country lazily.

    Example: GET /forecast/Kenya
    """
    data = cache.get("forecast", {})
    if country not in data:
        raise HTTPException(
            status_code=404,
            detail=f"Country '{country}' not found. Check spelling — names are case-sensitive."
        )
    return data[country]


@app.get("/countries")
def list_countries():
    """Returns the list of all available country names."""
    return sorted(cache.get("forecast", {}).keys())


@app.get("/health")
def health():
    """Health check — confirms the API is running and the forecast is loaded."""
    n = len(cache.get("forecast", {}))
    return {
        "status": "ok",
        "countries_loaded": n,
        "forecast_ready": n > 0,
    }
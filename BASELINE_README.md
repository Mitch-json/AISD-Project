# Baseline Model — Linear Regression for Electricity Demand Forecasting

## Overview

`baseline_model.py` implements an **OLS Linear Regression** model that predicts national **electricity demand (TWh)** one year ahead using lagged demand values and socio-economic indicators. It serves as the interpretable baseline against which the primary SARIMAX model will be compared.

## Input

| File | Description |
|------|-------------|
| `data/model_dataset.csv` | 667 rows × 18 columns — 28 countries, 2000–2023, zero missing values (produced by `code.py`) |

## Features (7)

| Feature | Type | Description |
|---------|------|-------------|
| `demand_lag1` | Autoregressive | Electricity demand one year prior |
| `demand_lag2` | Autoregressive | Electricity demand two years prior |
| `demand_lag3` | Autoregressive | Electricity demand three years prior |
| `demand_yoy_change` | Trend | Lagged year-over-year change (lag1 − lag2) |
| `gdp` | Exogenous | Country GDP (current USD) |
| `population` | Exogenous | Country population |
| `gdp_per_capita` | Exogenous | GDP / population |

## Train / Test Split

- **Train:** 2003–2019 (471 rows) — first 3 years per country are lost to lag creation
- **Test:** 2020–2023 (112 rows)
- Split is **strictly temporal** — no future data leaks into training

## How to Run

### Prerequisites

```
pip install pandas numpy scikit-learn matplotlib
```

### Execute

```bash
cd AISD-Project
python baseline_model.py
```

The script prints all metrics to the console and saves three diagnostic plots to the `plots/` directory.

## Output

### Console

1. **Overall metrics** — Train and Test RMSE / MAE
2. **Per-country test metrics** — RMSE and MAE for each of the 28 countries
3. **Model coefficients** — Learned weight for every feature plus intercept

### Plots (saved to `plots/`)

| File | Description |
|------|-------------|
| `baseline_pred_vs_actual.png` | Scatter of predicted vs actual demand on the test set |
| `baseline_residuals.png` | Histogram of residuals (actual − predicted) on the test set |
| `baseline_country_forecasts.png` | Time-series overlay (actual vs predicted) for the US, India, Germany, and Brazil |

## Results

| Set | RMSE (TWh) | MAE (TWh) |
|-----|-----------|----------|
| Train (2003–2019) | 37.38 | 15.30 |
| Test (2020–2023) | 58.75 | 23.01 |

## Why Linear Regression as the Baseline

- **Zero hyperparameters** — no tuning decisions, fully reproducible.
- **Fully interpretable** — each coefficient directly maps a feature to its effect on forecasted demand.
- **Fast** — trains in milliseconds.
- **Sets a meaningful performance floor** — the SARIMAX model must beat these numbers to justify its added complexity.
- **Matches the project proposal**, which specifies "a linear regression model using lagged demand and socio-economic features as an interpretable baseline."

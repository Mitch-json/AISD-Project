"""
Baseline Model — Linear Regression with Lagged Demand & Socio-Economic Features
================================================================================
Task:   Predict national electricity_demand (TWh) one year ahead
Method: OLS Linear Regression with lag-1/2/3 demand + GDP + population
Split:  Train 2000-2019  |  Test 2020-2023  (temporal split, no data leakage)
Metrics: RMSE, MAE (overall and per-country)
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, mean_absolute_error
import matplotlib
matplotlib.use("Agg")                       # non-interactive backend
import matplotlib.pyplot as plt
import os

# ──────────────────────────────────────────────────────────────────
# 1.  Load data
# ──────────────────────────────────────────────────────────────────
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "model_dataset.csv")
df = pd.read_csv(DATA_PATH)
print(f"Loaded {DATA_PATH}  →  {df.shape[0]} rows × {df.shape[1]} columns")
print(f"Countries: {df['country'].nunique()}   Years: {df['year'].min()}-{df['year'].max()}\n")

# ──────────────────────────────────────────────────────────────────
# 2.  Feature engineering — lag features (per country)
# ──────────────────────────────────────────────────────────────────
TARGET = "electricity_demand"
LAGS   = [1, 2, 3]                           # 1-year, 2-year, 3-year lags

df = df.sort_values(["country", "year"]).reset_index(drop=True)

for lag in LAGS:
    col = f"demand_lag{lag}"
    df[col] = df.groupby("country")[TARGET].shift(lag)

# Lagged year-over-year change (trend signal, NO leakage — uses t-1 minus t-2)
df["demand_yoy_change"] = df.groupby("country")[TARGET].diff().shift(1)

# GDP per capita (interaction between two exogenous variables)
df["gdp_per_capita"] = df["gdp"] / df["population"]

# Define feature columns
FEATURE_COLS = (
    [f"demand_lag{l}" for l in LAGS]          # autoregressive lags
    + ["demand_yoy_change"]                    # trend signal
    + ["gdp", "population", "gdp_per_capita"] # socio-economic exogenous vars
)

# Drop rows where lags are NaN (first 3 years per country)
df_model = df.dropna(subset=FEATURE_COLS + [TARGET]).copy()
print(f"After creating lag features: {len(df_model)} usable rows "
      f"(dropped first {max(LAGS)} years per country)\n")

# ──────────────────────────────────────────────────────────────────
# 3.  Temporal train / test split
# ──────────────────────────────────────────────────────────────────
TRAIN_END = 2019
TEST_START = 2020

train = df_model[df_model["year"] <= TRAIN_END]
test  = df_model[df_model["year"] >= TEST_START]

X_train, y_train = train[FEATURE_COLS], train[TARGET]
X_test,  y_test  = test[FEATURE_COLS],  test[TARGET]

print(f"Train set: {len(train)} rows  (2003-{TRAIN_END})")
print(f"Test  set: {len(test)} rows   ({TEST_START}-{df_model['year'].max()})")
print(f"Features : {FEATURE_COLS}\n")

# ──────────────────────────────────────────────────────────────────
# 4.  Train Linear Regression
# ──────────────────────────────────────────────────────────────────
model = LinearRegression()
model.fit(X_train, y_train)

y_pred_train = model.predict(X_train)
y_pred_test  = model.predict(X_test)

# ──────────────────────────────────────────────────────────────────
# 5.  Evaluation — overall metrics
# ──────────────────────────────────────────────────────────────────
def eval_metrics(y_true, y_pred, label=""):
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae  = mean_absolute_error(y_true, y_pred)
    print(f"{label:12s}  RMSE = {rmse:10.3f} TWh   MAE = {mae:10.3f} TWh")
    return rmse, mae

print("=" * 60)
print("OVERALL METRICS")
print("=" * 60)
train_rmse, train_mae = eval_metrics(y_train, y_pred_train, "Train")
test_rmse,  test_mae  = eval_metrics(y_test,  y_pred_test,  "Test")
print()

# ──────────────────────────────────────────────────────────────────
# 6.  Per-country test metrics
# ──────────────────────────────────────────────────────────────────
print("=" * 60)
print("PER-COUNTRY TEST METRICS")
print("=" * 60)
results = []
for country in sorted(test["country"].unique()):
    mask = test["country"] == country
    yt = y_test[mask]
    yp = y_pred_test[mask.values]
    rmse = np.sqrt(mean_squared_error(yt, yp))
    mae  = mean_absolute_error(yt, yp)
    results.append({"country": country, "n_test": mask.sum(),
                     "RMSE": round(rmse, 3), "MAE": round(mae, 3)})

results_df = pd.DataFrame(results).sort_values("RMSE", ascending=False)
print(results_df.to_string(index=False))
print()

# ──────────────────────────────────────────────────────────────────
# 7.  Learned coefficients (interpretability!)
# ──────────────────────────────────────────────────────────────────
print("=" * 60)
print("MODEL COEFFICIENTS")
print("=" * 60)
coef_df = pd.DataFrame({
    "feature": FEATURE_COLS,
    "coefficient": model.coef_
}).sort_values("coefficient", key=abs, ascending=False)
print(coef_df.to_string(index=False))
print(f"\nIntercept: {model.intercept_:.4f}")
print()

# ──────────────────────────────────────────────────────────────────
# 8.  Diagnostic plots
# ──────────────────────────────────────────────────────────────────
os.makedirs("plots", exist_ok=True)

# --- 8a. Predicted vs Actual scatter ---
fig, ax = plt.subplots(figsize=(7, 7))
ax.scatter(y_test, y_pred_test, alpha=0.6, edgecolors="k", linewidths=0.3)
lims = [min(y_test.min(), y_pred_test.min()) - 50,
        max(y_test.max(), y_pred_test.max()) + 50]
ax.plot(lims, lims, "r--", linewidth=1, label="Perfect prediction")
ax.set_xlabel("Actual electricity demand (TWh)")
ax.set_ylabel("Predicted electricity demand (TWh)")
ax.set_title("Baseline Linear Regression — Predicted vs Actual (Test Set)")
ax.legend()
fig.tight_layout()
fig.savefig("plots/baseline_pred_vs_actual.png", dpi=150)
print("Saved  plots/baseline_pred_vs_actual.png")

# --- 8b. Residual distribution ---
residuals = y_test.values - y_pred_test
fig, ax = plt.subplots(figsize=(8, 4))
ax.hist(residuals, bins=30, edgecolor="k", alpha=0.7)
ax.axvline(0, color="r", linestyle="--")
ax.set_xlabel("Residual (Actual − Predicted) TWh")
ax.set_ylabel("Frequency")
ax.set_title("Baseline Model — Residual Distribution (Test Set)")
fig.tight_layout()
fig.savefig("plots/baseline_residuals.png", dpi=150)
print("Saved  plots/baseline_residuals.png")

# --- 8c. Time-series overlay for a few sample countries ---
sample_countries = ["United States", "India", "Germany", "Brazil"]
sample_countries = [c for c in sample_countries if c in test["country"].values]

fig, axes = plt.subplots(len(sample_countries), 1,
                         figsize=(10, 3.5 * len(sample_countries)), sharex=False)
if len(sample_countries) == 1:
    axes = [axes]

for ax, country in zip(axes, sample_countries):
    cmask = df_model["country"] == country
    cdf = df_model[cmask].copy()
    cdf["predicted"] = model.predict(cdf[FEATURE_COLS])

    ax.plot(cdf["year"], cdf[TARGET], "o-", label="Actual", markersize=4)
    ax.plot(cdf["year"], cdf["predicted"], "s--", label="Predicted", markersize=4)
    ax.axvline(TEST_START - 0.5, color="gray", linestyle=":", label="Train/Test split")
    ax.set_title(country)
    ax.set_ylabel("Demand (TWh)")
    ax.legend(fontsize=8)

axes[-1].set_xlabel("Year")
fig.suptitle("Baseline Linear Regression — Demand Forecast by Country", y=1.01)
fig.tight_layout()
fig.savefig("plots/baseline_country_forecasts.png", dpi=150)
print("Saved  plots/baseline_country_forecasts.png")

# ──────────────────────────────────────────────────────────────────
# 9.  Summary
# ──────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"Model           : Linear Regression (OLS)")
print(f"Features ({len(FEATURE_COLS)})    : {', '.join(FEATURE_COLS)}")
print(f"Train RMSE      : {train_rmse:.3f} TWh")
print(f"Test  RMSE      : {test_rmse:.3f} TWh")
print(f"Train MAE       : {train_mae:.3f} TWh")
print(f"Test  MAE       : {test_mae:.3f} TWh")
print(f"Plots saved in  : plots/")

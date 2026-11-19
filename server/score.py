"""Score a pond reading with the trained scikit-learn and XGBoost models."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
from xgboost import XGBRegressor

DATA = Path(__file__).resolve().parent / "data"
FEATURES = ["ph", "rainMmH", "soilPct", "waterCm", "levelDeltaCm"]

_sklearn = joblib.load(DATA / "sklearn.joblib")
_xgboost = XGBRegressor()
_xgboost.load_model(DATA / "xgboost.json")
_report = json.loads((DATA / "report.json").read_text())


def predict(reading: dict) -> dict:
    values = []
    for name in FEATURES:
        value = reading.get(name, 0)
        if not isinstance(value, (int, float)):
            raise ValueError(name)
        values.append(float(value))
    features = np.array([values], dtype=np.float32)
    sklearn_score = float(_sklearn.predict(features)[0])
    xgboost_score = float(_xgboost.predict(features)[0])

    def clamp(score: float) -> float:
        return max(0.0, min(100.0, score))

    return {
        "sklearn": round(clamp(sklearn_score), 1),
        "xgboost": round(clamp(xgboost_score), 1),
        "sklearnMae": round(_report["sklearnMae"], 2),
        "xgboostMae": round(_report["xgboostMae"], 2),
        "labels": _report["labels"],
        "sklearnImportance": [round(float(value), 3) for value in _report["sklearnImportance"]],
        "xgboostImportance": [round(float(value), 3) for value in _report["xgboostImportance"]],
    }

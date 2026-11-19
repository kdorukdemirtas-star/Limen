#!/usr/bin/env python3
"""Fit scikit-learn and XGBoost on the pond readings."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
FEATURES = ["ph", "rainMmH", "soilPct", "waterCm", "levelDeltaCm"]
LABELS = ["pH", "Rain", "Soil moisture", "Water height", "Level change"]


def main() -> None:
    rows = json.loads((DATA / "readings.json").read_text())
    features = np.array([[float(row[name]) for name in FEATURES] for row in rows], dtype=np.float32)
    target = np.array([float(row["score"]) for row in rows], dtype=np.float32)
    train_index: list[int] = []
    test_index: list[int] = []
    groups: dict[str, list[int]] = {}
    for index, row in enumerate(rows):
        groups.setdefault(str(row.get("scenario", "all")), []).append(index)
    for indexes in groups.values():
        cut = int(len(indexes) * 0.8)
        train_index.extend(indexes[:cut])
        test_index.extend(indexes[cut:])
    train_x, test_x = features[train_index], features[test_index]
    train_y, test_y = target[train_index], target[test_index]

    sklearn_model = GradientBoostingRegressor(random_state=7)
    sklearn_model.fit(train_x, train_y)
    xgboost_model = XGBRegressor(
        n_estimators=160,
        max_depth=3,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=7,
        n_jobs=1,
    )
    xgboost_model.fit(train_x, train_y)

    report = {
        "features": FEATURES,
        "labels": LABELS,
        "samples": int(len(rows)),
        "trainSamples": int(len(train_index)),
        "testSamples": int(len(test_index)),
        "holdout": "last 20 percent of each pond condition, in time order",
        "sklearnMae": float(mean_absolute_error(test_y, sklearn_model.predict(test_x))),
        "xgboostMae": float(mean_absolute_error(test_y, xgboost_model.predict(test_x))),
        "sklearnImportance": [float(value) for value in sklearn_model.feature_importances_],
        "xgboostImportance": [float(value) for value in xgboost_model.feature_importances_],
    }
    DATA.mkdir(exist_ok=True)
    joblib.dump(sklearn_model, DATA / "sklearn.joblib")
    xgboost_model.save_model(DATA / "xgboost.json")
    (DATA / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

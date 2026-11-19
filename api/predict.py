"""Vercel function: scikit-learn and XGBoost score for the current reading."""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))

from score import predict  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        length = int(self.headers.get("content-length", "0"))
        try:
            reading = json.loads(self.rfile.read(length) or b"{}")
            payload = predict(reading)
            status = 200
        except (ValueError, KeyError, json.JSONDecodeError):
            payload = {"error": "The reading is incomplete."}
            status = 400
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

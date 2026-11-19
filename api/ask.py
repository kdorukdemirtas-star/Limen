"""Vercel function: MiniCPM stays on the local dashboard."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        raw = json.dumps(
            {
                "error": "MiniCPM runs with the local dashboard on this Mac. This hosted copy keeps the scikit-learn and XGBoost scores."
            }
        ).encode()
        self.send_response(501)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

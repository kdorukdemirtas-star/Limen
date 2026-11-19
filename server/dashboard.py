#!/usr/bin/env python3
"""One local site: the dashboard, scikit-learn, XGBoost, and MiniCPM-V 4.6."""

from __future__ import annotations

import json
import mimetypes
import re
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from guide import SYSTEM, prompt_for, retrieve
from score import predict

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
HOST = "127.0.0.1"
PORT = 5173
MODEL_PATH = (
    Path.home()
    / ".cache/huggingface/hub/models--mlx-community--MiniCPM-V-4.6-4bit/snapshots/86cd463d33a946e4481b77e3c10fc63121b60a19"
)

mind = {"ready": False, "error": "", "model": None, "processor": None}
mind_lock = threading.Lock()


def boot_minicpm() -> None:
    try:
        from mlx_vlm import load

        model, processor = load(str(MODEL_PATH))
        mind["model"] = model
        mind["processor"] = processor
        mind["ready"] = True
        print("MiniCPM-V 4.6 is on the dashboard.")
    except Exception as exc:
        mind["error"] = str(exc)
        print(f"MiniCPM did not load: {exc}")


def answer(question: str, reading: dict) -> tuple[str, list[str]]:
    if mind["error"]:
        raise RuntimeError(mind["error"])
    if not mind["ready"]:
        raise TimeoutError("loading")
    notes = retrieve(question)
    scored = predict(reading)
    enriched = {**reading, "sklearn": scored["sklearn"], "xgboost": scored["xgboost"]}
    user = prompt_for(question, notes, enriched)
    processor = mind["processor"]
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user},
    ]
    prompt = f"{SYSTEM}\n\n{user}"
    if hasattr(processor, "apply_chat_template"):
        try:
            prompt = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        except Exception:
            traceback.print_exc()
    from mlx_vlm import generate

    with mind_lock:
        result = generate(mind["model"], processor, prompt, max_tokens=180, temperature=0.2, verbose=False)
    text = getattr(result, "text", "") or ""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    return text, [note["title"] for note in notes]


def static_file(url_path: str) -> Path | None:
    relative = url_path.split("?", 1)[0].lstrip("/") or "index.html"
    if relative.startswith("api/"):
        return None
    candidate = (DIST / relative).resolve()
    root = DIST.resolve()
    if not str(candidate).startswith(str(root)):
        return None
    if candidate.is_file():
        return candidate
    fallback = root / "index.html"
    return fallback if fallback.is_file() else None


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/api/health":
            self._json(200, {"minicpm": mind["ready"], "error": mind["error"]})
            return
        path = static_file(self.path)
        if path is None:
            self.send_error(404)
            return
        body = path.read_bytes()
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 8000:
            self._json(400, {"error": "The request is empty."})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode())
        except json.JSONDecodeError:
            self._json(400, {"error": "The request is not JSON."})
            return
        if self.path == "/api/predict":
            try:
                self._json(200, predict(payload))
            except (ValueError, KeyError):
                self._json(400, {"error": "The reading is incomplete."})
            return
        if self.path != "/api/ask":
            self.send_error(404)
            return
        question = payload.get("question")
        reading = payload.get("reading")
        if not isinstance(question, str) or not isinstance(reading, dict):
            self._json(400, {"error": "Question is missing."})
            return
        question = question.strip()
        if not question or len(question) > 500:
            self._json(400, {"error": "Ask in one short question."})
            return
        try:
            text, notes = answer(question, reading)
        except TimeoutError:
            self._json(503, {"error": "MiniCPM is still loading on this dashboard."})
            return
        except Exception:
            traceback.print_exc()
            self._json(503, {"error": "MiniCPM is not answering."})
            return
        if not text:
            self._json(503, {"error": "MiniCPM is not answering."})
            return
        self._json(200, {"answer": text, "notes": notes})

    def _json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} {fmt % args}")


def main() -> None:
    if not (DIST / "index.html").is_file():
        raise SystemExit("Build the dashboard first: npm run build")
    threading.Thread(target=boot_minicpm, daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Dashboard on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()

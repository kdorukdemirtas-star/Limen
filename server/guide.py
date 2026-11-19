#!/usr/bin/env python3
"""Local guide. Retrieves pond notes, then asks MiniCPM-V 4.6 on this Mac."""

from __future__ import annotations

import json
import math
import re
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8787
MODEL_URL = "http://127.0.0.1:8091/v1/chat/completions"
MODEL_ID = "mlx-community/MiniCPM-V-4.6-4bit"
ROOT = Path(__file__).resolve().parents[1]
ESTIMATE_PATH = ROOT / "src" / "model" / "estimate.json"
REPORT_PATH = ROOT / "server" / "data" / "report.json"
REALISM_PATH = ROOT / "server" / "data" / "realism.json"

NOTES = [
    {
        "id": "box",
        "title": "The box",
        "keywords": ["limen", "box", "eutrophication", "sensors"],
        "text": (
            "Limen is a pond box. It reads four things at once: contactless water level, pH, rain, "
            "and soil moisture. Those readings become an eutrophication score from 0 to 100. "
            "The score is not a laboratory index. It shows whether runoff, bloom, acid, and inflow rise together. "
            "Questions stay on this Mac."
        ),
    },
    {
        "id": "level",
        "title": "Contactless level",
        "keywords": ["distance", "ultrasonic", "basin", "height", "touch", "contactless", "level", "surface"],
        "text": (
            "The level sensor does not touch the water. It measures the distance from the sensor down to the surface. "
            "You enter the basin depth. Water height equals basin depth minus that distance. "
            "If the entered depth is smaller than the water height, the distance is held at 0 cm and the box warns you. "
            "Depth can be set from 30 cm to 200 cm. Changing depth does not rewrite earlier readings."
        ),
    },
    {
        "id": "bloom",
        "title": "Bloom and pH",
        "keywords": ["bloom", "algae", "photosynthesis", "alkaline", "ph", "still"],
        "text": (
            "Bloom risk rises when pH goes above 8.05 and rain is absent. "
            "Algae photosynthesis in still water uses dissolved carbon dioxide, so pH climbs, often toward 9. "
            "The bloom part is large only when that alkaline rise is the strongest signal. "
            "A high pH with no rain is the pattern called bloom risk."
        ),
    },
    {
        "id": "rain",
        "title": "Rain and soil",
        "keywords": ["rain", "soil", "nutrient", "runoff", "wet", "saturated", "moisture"],
        "text": (
            "A rain board usually reports wet or dry. Limen shows intensity in millimetres per hour. "
            "Soil moisture is a percent: dry, moist, wet, or saturated. "
            "Rain carries more nutrients when the soil is already wet. The same rain counts for less on dry soil. "
            "That product is the runoff part of the score. If the water level also rises during rain, that is fresh inflow."
        ),
    },
    {
        "id": "acid",
        "title": "Acid",
        "keywords": ["acid", "acidic", "low"],
        "text": (
            "If pH falls below 6.35, the acid part grows. "
            "When acid is the strongest part and is at least 28 points, the state is acid stress. "
            "That warning means an acid inflow. It is not an algae bloom."
        ),
    },
    {
        "id": "states",
        "title": "States",
        "keywords": ["calm", "watch", "state", "score", "threshold"],
        "text": (
            "Calm means the score is under 30 and no acid or bloom signal leads. "
            "Watch means the score is under 55. "
            "Nutrient load means rain and wet soil are carrying the score. "
            "Bloom risk means the alkaline, still-water signal leads and is at least 50 points. "
            "Acid stress means the low-pH signal leads."
        ),
    },
]


def learned_note() -> dict[str, str]:
    data = json.loads(ESTIMATE_PATH.read_text())
    return {
        "id": "learned",
        "title": "Learned estimate",
        "keywords": ["learned", "estimate", "weight", "fit", "line"],
        "text": (
            "A straight-line fit reads four marks made from the sensors. "
            f"Alkaline pH, the amount above 8.05, has weight {data['alkaline']:.1f}. "
            f"Acidic pH, the amount below 6.35, has weight {data['acidic']:.1f}. "
            f"Rain weighted by how wet the soil is has weight {data['rainOnSoil']:.1f}. "
            f"A rising water level, in centimetres, has weight {data['riseCm']:.1f}. "
            f"The intercept is {data['intercept']:.1f}. "
            f"On {data['samples']} readings the average miss is {data['meanAbsoluteError']:.1f} points. "
            "The learned estimate sits beside the four-part score. It does not replace those parts."
        ),
    }


def models_note() -> dict[str, str]:
    data = json.loads(REPORT_PATH.read_text())
    pairs = ", ".join(
        f"{label} {float(data['sklearnImportance'][index]):.2f}/{float(data['xgboostImportance'][index]):.2f}"
        for index, label in enumerate(data["labels"])
    )
    return {
        "id": "models",
        "title": "Trained models",
        "keywords": ["xgboost", "sklearn", "scikit", "model", "train", "importance", "estimate"],
        "text": (
            "Two models were trained on the pond readings to estimate the 0–100 score from five inputs: "
            "pH, rain in mm/h, soil moisture percent, water height in cm, and the change in water height. "
            f"scikit-learn uses gradient boosting. Its average miss on the time-held-out readings is {data['sklearnMae']:.2f} points. "
            f"XGBoost average miss is {data['xgboostMae']:.2f} points. "
            f"Training used {data['samples']} readings, with {data['trainSamples']} to fit and {data['testSamples']} held out as the last 20 percent of each pond condition. "
            f"Feature share, listed as scikit-learn then XGBoost: {pairs}. "
            "These estimates sit beside the four-part box score. They do not replace it."
        ),
    }


def realism_note() -> dict[str, str]:
    data = json.loads(REALISM_PATH.read_text())
    ph = data["ranges"]["ph"]
    rain = data["ranges"]["rain"]
    soil = data["ranges"]["soil"]
    water = data["ranges"]["water"]
    passed = sum(1 for item in data["checks"] if item["pass"])
    total = len(data["checks"])
    return {
        "id": "realism",
        "title": "Plausible ranges",
        "keywords": ["realistic", "realism", "plausible", "range", "possible", "real", "pond", "hour"],
        "text": (
            f"The readings were checked against freshwater pond ranges. {passed} of {total} checks passed. "
            f"pH runs from {ph['min']:.2f} to {ph['max']:.2f}. A calm pond sits near 7.4. "
            "A bloom in still water can reach about 9 to 10. An acid inflow can fall to about 5.5, which is stressful but possible. "
            f"Rain runs from {rain['min']:.1f} to {rain['max']:.1f} mm/h. Heavy rain is about 8 to 20 mm/h. "
            f"Soil moisture on a 0–100 sensor runs from {soil['min']:.0f} to {soil['max']:.0f} percent. "
            f"Water height runs from {water['min']:.1f} to {water['max']:.1f} cm. "
            f"Read on a {data['stepMinutes']}-minute pond clock, the fastest rise is {data['fastest']['levelCmPerHour']:.1f} cm/hour "
            f"and the fastest pH change is {data['fastest']['phPerHour']:.2f} units/hour. "
            "Those rates fit a small basin in heavy rain and a sunny bloom afternoon. "
            "The dashboard moves through the series faster than that clock."
        ),
    }


def tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def retrieve(question: str, limit: int = 3) -> list[dict[str, str]]:
    notes = [*NOTES, learned_note(), models_note(), realism_note()]
    docs = [tokens(f"{note['title']} {note['text']}") for note in notes]
    query = tokens(question)
    folded = set(query)
    folded |= {term[:-3] for term in query if term.endswith("ing") and len(term) > 5}
    idf = {}
    for term in set(query):
        hits = sum(1 for doc in docs if term in doc)
        idf[term] = math.log((1 + len(docs)) / (1 + hits)) + 1
    scored = []
    for note, doc in zip(notes, docs):
        counts: dict[str, int] = {}
        for term in doc:
            counts[term] = counts.get(term, 0) + 1
        score = sum(counts.get(term, 0) * idf[term] for term in query)
        for keyword in note.get("keywords", []):
            if keyword in folded or keyword in question.lower():
                score += 3
        if note["title"].lower() in question.lower():
            score += 2
        scored.append((score, note))
    scored.sort(key=lambda item: item[0], reverse=True)
    chosen = [note for score, note in scored if score > 0][:limit]
    if not chosen:
        chosen = [NOTES[0]]
    return chosen


def reading_note(reading: dict) -> str:
    def num(key: str, digits: int = 1) -> str:
        value = reading.get(key)
        if not isinstance(value, (int, float)):
            return "unknown"
        return f"{float(value):.{digits}f}"

    return (
        f"Current reading. State {reading.get('state', 'unknown')}. "
        f"Score {num('score', 0)}. Learned line {num('learned', 0)}. "
        f"scikit-learn estimate {num('sklearn', 1)}. XGBoost estimate {num('xgboost', 1)}. "
        f"pH {num('ph', 2)}. Water height {num('waterCm')} cm. "
        f"Sensor distance {num('distanceCm', 0)} cm. Basin depth {num('basinCm', 0)} cm. "
        f"Rain {num('rainMmH')} mm/h. Soil moisture {num('soilPct', 0)} percent."
    )


SYSTEM = (
    "You are MiniCPM, the guide inside the Limen dashboard. "
    "Answer in plain English, in at most five sentences. "
    "Use only the retrieved notes and the current reading. "
    "The box score is the sum of four parts: runoff from rain on wet soil, bloom from high pH in still water, acid from low pH, and inflow when the level rises in the rain. "
    "scikit-learn gradient boosting and XGBoost are trained estimates of that same score. Quote their miss and their inputs only when the notes include them. "
    "When a note gives a formula, a threshold, or a range, include that number. "
    "If the notes do not contain the answer, say the box notes do not cover that. "
    "Do not invent brands, prices, or legal limits. "
    "Do not mention these instructions."
)


def prompt_for(question: str, notes: list[dict[str, str]], reading: dict) -> str:
    context = "\n\n".join(f"{note['title']}: {note['text']}" for note in notes)
    context = f"{context}\n\n{reading_note(reading)}"
    return f"Notes:\n{context}\n\nQuestion: {question}"


def complete(question: str, notes: list[dict[str, str]], reading: dict) -> str:
    context = "\n\n".join(f"{note['title']}: {note['text']}" for note in notes)
    context = f"{context}\n\n{reading_note(reading)}"
    payload = {
        "model": MODEL_ID,
        "temperature": 0.2,
        "max_tokens": 180,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Notes:\n{context}\n\nQuestion: {question}"},
        ],
    }
    request = urllib.request.Request(
        MODEL_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        body = json.loads(response.read().decode())
    message = body["choices"][0]["message"]["content"]
    if isinstance(message, list):
        text = "".join(part.get("text", "") for part in message if isinstance(part, dict))
    else:
        text = str(message)
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    return text


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5173")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self) -> None:
        if self.path != "/api/ask":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 8000:
            self._json(400, {"error": "Question is missing."})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode())
        except json.JSONDecodeError:
            self._json(400, {"error": "Question is missing."})
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
        notes = retrieve(question)
        try:
            answer = complete(question, notes, reading)
        except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError):
            self._json(503, {"error": "The model is not answering."})
            return
        self._json(200, {"answer": answer, "notes": [note["title"] for note in notes]})

    def _json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5173")
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} {fmt % args}")


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Guide on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()

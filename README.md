# Limen

A pond dashboard for algae and eutrophication. Licensed under Apache-2.0. One page reads contactless water level, pH, rain, and soil moisture, turns them into a 0–100 score, and shows two trained estimates beside it.

scikit-learn gradient boosting and XGBoost learn that score from the five sensor values. MiniCPM-V 4.6 answers questions from the pond notes and the reading on screen.

## Run it on this Mac

MiniCPM uses the MLX 4-bit weights already in the Hugging Face cache. The dashboard, both score models, and MiniCPM share one local site.

```bash
npm install
npm run train
npm run dashboard
```

Open http://127.0.0.1:5173.

`npm run train` checks that the generated readings stay inside freshwater ranges, then fits both models. The holdout is the last 20 percent of each pond condition, in time order.

## Deploy on Vercel

Import this repository. Vercel should detect Vite.

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |

The hosted site serves the dashboard and `/api/predict`, which runs the same scikit-learn and XGBoost models. MiniCPM stays on the Mac. Its weights are an Apple MLX build and do not fit a hosted function, so the Guide on the hosted site says so instead of pretending to answer.

## Layout

- `src/` is the dashboard.
- `server/dashboard.py` is the local site.
- `server/score.py` loads the trained models.
- `api/` is what Vercel runs for the score and the guide notice.
- `server/data/` holds the fitted models and the realism check.

import { useEffect, useState } from 'react';
import { useSession } from './session.tsx';

interface Prediction {
  sklearn: number;
  xgboost: number;
  sklearnMae: number;
  xgboostMae: number;
  labels: string[];
  sklearnImportance: number[];
  xgboostImportance: number[];
}

export function Models() {
  const { sample } = useSession();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const reading = {
      ph: sample.ph,
      rainMmH: sample.rainMmH,
      soilPct: sample.soilPct,
      waterCm: sample.waterCm,
      levelDeltaCm: sample.levelDeltaCm,
    };
    fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reading),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<Prediction>;
      })
      .then((payload) => {
        setPrediction(payload);
        setError('');
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError('The scikit-learn and XGBoost models are not answering on this dashboard.');
      });
    return () => controller.abort();
  }, [sample.ph, sample.rainMmH, sample.soilPct, sample.waterCm, sample.levelDeltaCm]);

  return (
    <section className="panel" aria-labelledby="models-heading">
      <div className="section-head">
        <h2 id="models-heading">Models</h2>
        <p>scikit-learn and XGBoost each estimate the score from the five sensor readings on screen.</p>
      </div>
      {error ? (
        <p className="warning" role="alert">
          {error}
        </p>
      ) : null}
      {prediction ? (
        <div className="sensor-grid">
          <ModelCard
            title="scikit-learn"
            detail="Gradient boosting"
            score={prediction.sklearn}
            mae={prediction.sklearnMae}
            labels={prediction.labels}
            importance={prediction.sklearnImportance}
          />
          <ModelCard
            title="XGBoost"
            detail="Boosted trees"
            score={prediction.xgboost}
            mae={prediction.xgboostMae}
            labels={prediction.labels}
            importance={prediction.xgboostImportance}
          />
        </div>
      ) : error ? null : (
        <p>Fitting the current reading.</p>
      )}
    </section>
  );
}

function ModelCard({
  title,
  detail,
  score,
  mae,
  labels,
  importance,
}: {
  title: string;
  detail: string;
  score: number;
  mae: number;
  labels: string[];
  importance: number[];
}) {
  return (
    <article className="sensor">
      <h3>{title}</h3>
      <p className="sensor-value">
        {score.toFixed(0)} <span>{detail}</span>
      </p>
      <p className="sensor-note">Average miss on held-out readings: {mae.toFixed(1)} points.</p>
      <div className="drivers">
        {labels.map((label, index) => {
          const share = Math.round((importance[index] ?? 0) * 100);
          return (
            <div className="driver" key={label}>
              <div className="driver-top">
                <span>{label}</span>
                <span className="num">{share}</span>
              </div>
              <div
                className="track"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={share}
                aria-label={`${title} weight for ${label}`}
              >
                <span style={{ transform: `scaleX(${share / 100})` }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

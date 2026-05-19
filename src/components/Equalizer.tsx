import React, { useCallback, useState, useMemo } from 'react';
import { EQ_LABELS, EQ_PRESETS, EqPreset } from '../hooks/useEqualizer';

interface EqualizerProps {
  visible: boolean;
  onClose: () => void;
  gains: number[];
  enabled: boolean;
  preset: string;
  onSetBandGain: (index: number, gain: number) => void;
  onReset: () => void;
  onSetEnabled: (on: boolean) => void;
  onApplyPreset: (name: string) => void;
}

const DB_MARKS = [20, 10, 0, -10, -20];
const BAND_COUNT = 31;

function generateCurvePaths(gains: number[]): { line: string; fill: string } {
  const points = gains.map((g, i) => ({
    x: i + 0.5,
    y: 20 - g,
  }));

  if (points.length < 2) return { line: '', fill: '' };

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const fillD = d + ` L ${last.x.toFixed(2)} 20 L ${first.x.toFixed(2)} 20 Z`;

  return { line: d, fill: fillD };
}

export const Equalizer = React.memo(function Equalizer({
  visible, onClose, gains, enabled, preset,
  onSetBandGain, onReset, onSetEnabled, onApplyPreset,
}: EqualizerProps) {
  const [hoveredBand, setHoveredBand] = useState<number | null>(null);

  const handleSliderChange = useCallback((index: number, value: number) => {
    onSetBandGain(index, value);
  }, [onSetBandGain]);

  const handleDoubleClick = useCallback((index: number) => {
    onSetBandGain(index, 0);
  }, [onSetBandGain]);

  const curvePaths = useMemo(() => generateCurvePaths(gains), [gains]);

  if (!visible) return null;

  return (
    <div className="eq-overlay" onClick={onClose}>
      <div className="eq-panel" onClick={(e) => e.stopPropagation()}>
        <div className="eq-header">
          <div className="eq-title-row">
            <h3>31 段均衡器</h3>
            <div className="eq-header-actions">
              <label className="eq-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => onSetEnabled(e.target.checked)}
                />
                <span className="eq-toggle-slider" />
                <span className="eq-toggle-label">{enabled ? 'ON' : 'OFF'}</span>
              </label>
              <button className="eq-reset-btn" onClick={onReset} title="重置">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
              </button>
              <button className="eq-close-btn" onClick={onClose}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="eq-presets">
            {EQ_PRESETS.map((p: EqPreset) => (
              <button
                key={p.name}
                className={`eq-preset-btn ${preset === p.name ? 'active' : ''}`}
                onClick={() => onApplyPreset(p.name)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`eq-body ${!enabled ? 'eq-body-disabled' : ''}`}>
          <div className="eq-db-axis">
            {DB_MARKS.map(db => (
              <span key={db} className="eq-db-label">{db > 0 ? `+${db}` : db}</span>
            ))}
          </div>
          <div className="eq-sliders-wrap">
            <div className="eq-grid-lines">
              {DB_MARKS.map(db => (
                <div key={db} className={`eq-grid-line ${db === 0 ? 'eq-grid-zero' : ''}`} />
              ))}
            </div>
            <svg
              className="eq-curve-svg"
              viewBox={`0 0 ${BAND_COUNT} 40`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="eqCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fa2d48" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#fa2d48" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#fa2d48" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              <path d={curvePaths.fill} fill="url(#eqCurveGrad)" />
              <path
                d={curvePaths.line}
                fill="none"
                stroke="#fa2d48"
                strokeWidth="0.12"
                opacity="0.8"
              />
              {gains.map((g, i) => (
                <circle
                  key={i}
                  cx={i + 0.5}
                  cy={20 - g}
                  r={hoveredBand === i ? 0.45 : 0.25}
                  fill="#fa2d48"
                  opacity={hoveredBand === i ? 1 : 0.5}
                />
              ))}
            </svg>
            <div className="eq-sliders">
              {gains.map((gain, i) => (
                <div key={i} className="eq-band">
                  {hoveredBand === i && (
                    <div className="eq-tooltip">
                      {gain > 0 ? `+${gain}` : gain} dB
                    </div>
                  )}
                  <div className="eq-slider-container">
                    <input
                      type="range"
                      min={-20}
                      max={20}
                      step={0.5}
                      value={gain}
                      onChange={(e) => handleSliderChange(i, parseFloat(e.target.value))}
                      onMouseEnter={() => setHoveredBand(i)}
                      onMouseLeave={() => setHoveredBand(null)}
                      onDoubleClick={() => handleDoubleClick(i)}
                      className={`eq-slider ${!enabled ? 'eq-slider-disabled' : ''}`}
                      disabled={!enabled}
                    />
                  </div>
                  <span className="eq-freq-label">{EQ_LABELS[i]}</span>
                </div>
              ))}
            </div>
            {!enabled && <div className="eq-disabled-overlay" />}
          </div>
        </div>
      </div>
    </div>
  );
});

import { useEffect, useState, type CSSProperties } from 'react';

export function OpeningSplash() {
  const [visible, setVisible] = useState(true);
  const [splitOffset] = useState(() => Math.round(Math.random() * 24 - 12));

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setVisible(false), reducedMotion ? 250 : 1500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="opening-splash"
      aria-hidden="true"
      style={{ '--opening-split-offset': `${splitOffset}%` } as CSSProperties}
    >
      <div className="opening-splash__door opening-splash__door--left" />
      <div className="opening-splash__door opening-splash__door--right" />
      <p className="opening-splash__title">RegloireStudio</p>
    </div>
  );
}

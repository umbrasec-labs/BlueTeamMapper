import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs` while `enabled`. Drives elapsed clocks. */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}

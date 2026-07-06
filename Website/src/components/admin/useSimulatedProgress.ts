"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  /** Target percent before the task completes (default 92). */
  cap?: number;
  /** Rough duration to reach `cap` while the task is still running. */
  estimatedMs?: number;
};

/**
 * Smooth simulated progress for server tasks that don't stream real progress.
 * Call `finish()` when the task succeeds, then briefly hold at 100% before hiding.
 */
export function useSimulatedProgress(active: boolean, options: Options = {}) {
  const cap = options.cap ?? 92;
  const estimatedMs = options.estimatedMs ?? 45000;
  const [percent, setPercent] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      finishedRef.current = false;
      setPercent(0);
      return;
    }
    finishedRef.current = false;
    setPercent(4);
    const start = Date.now();
    const id = window.setInterval(() => {
      if (finishedRef.current) return;
      const t = Math.min(1, (Date.now() - start) / estimatedMs);
      const eased = 1 - Math.pow(1 - t, 2.5);
      setPercent(Math.min(cap, 4 + eased * (cap - 4)));
    }, 120);
    return () => window.clearInterval(id);
  }, [active, cap, estimatedMs]);

  const finish = useCallback(() => {
    finishedRef.current = true;
    setPercent(100);
  }, []);

  const setExact = useCallback((value: number) => {
    finishedRef.current = true;
    setPercent(Math.max(0, Math.min(100, value)));
  }, []);

  return { percent, finish, setExact };
}

export async function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/** Pick a status line from thresholds based on current progress. */
export function progressMessage(
  percent: number,
  steps: { until: number; text: string }[],
  fallback: string,
): string {
  for (const step of steps) {
    if (percent < step.until) return step.text;
  }
  return fallback;
}

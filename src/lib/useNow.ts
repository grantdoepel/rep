"use client";
import { useEffect, useState } from "react";

/** The current time, null until mounted (screens are prerendered), refreshed every `ms`. */
export function useNow(ms = 30000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, ms);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [ms]);
  return now;
}

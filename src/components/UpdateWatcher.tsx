import { useEffect, useState } from "react";
import { useRegister } from "@/lib/register-store";

const CHECK_EVERY_MS = 60_000;

/** Asset file names (they change on every deploy) found in a piece of HTML. */
function assetsIn(html: string): string[] {
  return [...new Set(html.match(/\/assets\/[\w.-]+\.(?:js|css)/g) ?? [])].sort();
}

async function fetchLiveHtml(): Promise<string | null> {
  try {
    const res = await fetch(`/?v=${Date.now()}`, { cache: "no-store", credentials: "same-origin" });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

/**
 * Keeps every open copy of the app up to date after a new version is published:
 * - checks for a new version every minute and when the tab comes back into view;
 * - reloads by itself while the tab is in the background and no sale is in progress;
 * - otherwise shows an "Update now" bar, so nobody loses a sale they are entering.
 */
export function UpdateWatcher() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let baseline: string[] | null = null;
    let stopped = false;
    const mine = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src*="/assets/"]')).map((s) => new URL(s.src).pathname);

    const safeToReload = () => document.hidden && !(useRegister.getState().lines?.length);

    async function check() {
      if (stopped || !navigator.onLine) return;
      const html = await fetchLiveHtml();
      if (!html) return;
      const live = assetsIn(html);
      if (!live.length) return;
      let changed = false;
      if (mine.length) changed = mine.some((src) => !live.includes(src));
      else if (!baseline) baseline = live;
      else changed = live.join() !== baseline.join();
      if (!changed) return;
      if (safeToReload()) window.location.reload();
      else setAvailable(true);
    }

    void check();
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    const onVisibility = () => {
      if (document.hidden && available && safeToReload()) window.location.reload();
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [available]);

  if (!available) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-primary px-4 py-3 text-sm text-primary-foreground shadow-lg print:hidden">
      <span>A new version of the app is ready.</span>
      <button type="button" className="rounded-md bg-background px-3 py-1.5 font-semibold text-foreground" onClick={() => window.location.reload()}>
        Update now
      </button>
    </div>
  );
}

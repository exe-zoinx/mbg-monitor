/**
 * SPPG fetch + JSON.parse off the main thread.
 * The /api/sppg payload is ~3.6MB raw — parsing it on the main thread
 * blocks interaction for seconds on mobile. Worker keeps the UI responsive.
 * Self-executes on startup; posts one result, then the main thread terminates it.
 */
async function fetchSppg() {
  try {
    const res = await fetch('/api/sppg');
    if (!res.ok) throw new Error(`SPPG fetch failed: HTTP ${res.status}`);
    const data = await res.json();
    self.postMessage({ ok: true, data });
  } catch (err) {
    self.postMessage({ ok: false, error: err.message });
  }
}

fetchSppg();

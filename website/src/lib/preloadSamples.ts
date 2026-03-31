export interface Sample {
  model: string;
  label: string;
  description: string;
  content: string;
}

let cached: Sample[] | null = null;
let loading: Promise<Sample[]> | null = null;

/** Start background loading of sample skill data. Safe to call multiple times. */
export function preloadSamples() {
  if (cached || loading) return;
  loading = import("../data/sampleSkills").then((m) => {
    cached = m.default;
    return cached;
  });
}

/** Get cached samples, or trigger load and resolve when ready. */
export function getSamples(): Promise<Sample[]> {
  if (cached) return Promise.resolve(cached);
  preloadSamples();
  return loading!;
}

export function getCached(): Sample[] | null {
  return cached;
}

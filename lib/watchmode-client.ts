// Thin Watchmode client used only to flag the most well-known UK streaming
// service a title is on. IMDb's own dataset has no platform data at all —
// see lib/omdb-client.ts for the same live-fetch-only-for-shown-titles
// pattern, used here for the same reason (free-tier budget, no bulk backfill).

const BASE = "https://api.watchmode.com/v1";
const KEY = process.env.WATCHMODE_API_KEY;
const REGION = "GB";

// Watchmode returns whatever it has under vendor-specific names (including
// bundled "channel" variants like "AppleTV+ Amazon Channel"). This maps the
// names we've actually observed to a clean display label, ordered by how
// well-known the service is — first match wins when a title has several.
const PRIORITY: Array<{ match: RegExp; label: string }> = [
  { match: /^Netflix$/, label: "Netflix" },
  { match: /^Prime Video$/, label: "Prime Video" },
  { match: /^Disney\+$/, label: "Disney+" },
  // Free, near-universal UK catch-up services rank above smaller/paid ones —
  // BBC iPlayer alone reaches more UK households than most subscription
  // add-ons, so it belongs ahead of things like Sky Go.
  { match: /^BBC iPlayer$/, label: "BBC iPlayer" },
  { match: /^AppleTV\+/, label: "Apple TV+" },
  { match: /^ITVX$/, label: "ITVX" },
  { match: /^(All 4|Channel 4)$/, label: "All 4" },
  { match: /^(My5|Channel 5)$/, label: "My5" },
  { match: /^NOW$/, label: "NOW" },
  { match: /^Sky Go$/, label: "Sky Go" },
  { match: /^Paramount\+/, label: "Paramount+" },
  { match: /^discovery\+/i, label: "Discovery+" },
  { match: /^BritBox/, label: "BritBox" },
  { match: /^(Max|HBO Max)$/, label: "HBO Max" },
  { match: /^UKTV Play$/, label: "UKTV Play" },
  { match: /^Peacock/, label: "Peacock" },
];

interface Source {
  name: string;
  type: string; // "sub" | "free" | "rent" | "buy" | ...
}

const cache = new Map<string, string | null>();

function bestLabel(sources: Source[]): string | null {
  const streamable = sources.filter((s) => s.type === "sub" || s.type === "free");
  for (const { match, label } of PRIORITY) {
    if (streamable.some((s) => match.test(s.name))) return label;
  }
  return null;
}

export async function fetchTopService(imdbId: string): Promise<string | null> {
  if (!KEY) return null;
  if (cache.has(imdbId)) return cache.get(imdbId)!;

  try {
    const q = new URLSearchParams({ apiKey: KEY, regions: REGION });
    const res = await fetch(`${BASE}/title/${imdbId}/sources/?${q.toString()}`);
    if (!res.ok) throw new Error(`Watchmode ${res.status}`);
    const sources = (await res.json()) as Source[];
    const label = Array.isArray(sources) ? bestLabel(sources) : null;
    cache.set(imdbId, label);
    return label;
  } catch {
    cache.set(imdbId, null);
    return null;
  }
}

export async function fetchTopServices(imdbIds: string[]): Promise<Map<string, string | null>> {
  const results = await Promise.all(
    imdbIds.map(async (id) => [id, await fetchTopService(id)] as const),
  );
  return new Map(results);
}

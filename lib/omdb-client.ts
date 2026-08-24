// Thin OMDb client used only to fetch a one-sentence plot per title.
// IMDb's own bulk dataset (lib/imdb-data.json) has no plot text at all.
//
// Deliberately request-time, not baked into the dataset: OMDb's free tier is
// 1,000 req/day, far too little to backfill 60k+ titles, and plot text
// would bloat the bundle. Instead we fetch only the ~10 titles shown per
// board load, and cache each result in memory for the life of the process.

const BASE = "https://www.omdbapi.com/";
const KEY = process.env.OMDB_API_KEY;

const cache = new Map<string, string | null>();

function firstSentence(plot: string): string {
  const trimmed = plot.trim();
  const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : trimmed).slice(0, 200);
}

export async function fetchPlot(imdbId: string): Promise<string | null> {
  if (!KEY) return null;
  if (cache.has(imdbId)) return cache.get(imdbId)!;

  try {
    const q = new URLSearchParams({ i: imdbId, plot: "short", apikey: KEY });
    const res = await fetch(`${BASE}?${q.toString()}`);
    if (!res.ok) throw new Error(`OMDb ${res.status}`);
    const data = await res.json();
    const plot: string | null =
      data?.Response === "True" && data.Plot && data.Plot !== "N/A" ? firstSentence(data.Plot) : null;
    cache.set(imdbId, plot);
    return plot;
  } catch {
    cache.set(imdbId, null); // don't hammer OMDb on repeat failures within this process
    return null;
  }
}

export async function fetchPlots(imdbIds: string[]): Promise<Map<string, string | null>> {
  const results = await Promise.all(imdbIds.map(async (id) => [id, await fetchPlot(id)] as const));
  return new Map(results);
}

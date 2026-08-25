import type { BoardResult, MediaType, PopularWindow, SortBy, Title } from "./types";
import rawData from "./imdb-data.json";
import { fetchPlots } from "./omdb-client";
import { fetchTopServices } from "./watchmode-client";

// Pre-filtered, joined snapshot of IMDb's public non-commercial datasets
// (title.basics.tsv.gz + title.ratings.tsv.gz), baked by
// scripts/build-imdb-data.mjs. No live API calls — see that script to
// refresh the data.
interface RawTitle {
  id: string;
  title: string;
  type: MediaType;
  year: number | null;
  genres: string[];
  rating: number;
  votes: number;
}

const ALL = rawData as RawTitle[];

// "Popular" has no live trending signal to draw on (unlike TMDB's daily
// popularity score), so it's approximated as: recent titles, ranked by how
// many people have rated them on IMDb. IMDb's dataset is year-only (no
// month/day), so a "duration" picker can only bucket by year — "span" is
// how many calendar years (inclusive of this one) count as "recent".
const POPULAR_WINDOWS: Record<PopularWindow, number | null> = {
  "1": 1,
  "2": 2,
  "5": 5,
  "10": 10,
  all: null,
};

// The dataset's own build-time floor (1000 votes) still lets obscure,
// small-fanbase titles rack up a 9+ average. Ranking by rating needs a much
// higher floor to surface titles people have actually heard of.
const RATING_MIN_VOTES = 10000;

function toTitle(r: RawTitle, plots: Map<string, string | null>, services: Map<string, string | null>): Title {
  return {
    id: r.id,
    title: r.title,
    link: `https://www.imdb.com/title/${r.id}/`,
    rating: r.rating,
    votes: r.votes,
    year: r.year,
    genres: r.genres,
    summary: plots.get(r.id) ?? null,
    service: services.get(r.id) ?? null,
  };
}

const PAGE_SIZE = 10;

export async function fetchBoard(
  mediaType: MediaType,
  sortBy: SortBy,
  docsOnly: boolean,
  popularWindow: PopularWindow = "5",
  offset = 0
): Promise<BoardResult> {
  let rows = ALL.filter((r) => r.type === mediaType);
  if (docsOnly) rows = rows.filter((r) => r.genres.includes("Documentary"));

  if (sortBy === "popularity") {
    const span = POPULAR_WINDOWS[popularWindow];
    let recent = rows;
    if (span != null) {
      const currentYear = new Date().getFullYear();
      recent = rows.filter((r) => r.year != null && r.year >= currentYear - span + 1);
      if (recent.length < 10) recent = rows; // fall back to all-time if the window is too thin
    }
    rows = [...recent].sort((a, b) => b.votes - a.votes);
  } else {
    let popular = rows.filter((r) => r.votes >= RATING_MIN_VOTES);
    if (popular.length < 10) popular = rows; // fall back to the base pool for thin slices (e.g. niche docs)
    rows = [...popular].sort((a, b) => b.rating - a.rating || b.votes - a.votes);
  }

  if (!rows.length) throw new Error("No results");
  const page = rows.slice(offset, offset + PAGE_SIZE);
  if (!page.length) throw new Error("No more results");
  const ids = page.map((r) => r.id);
  const [plots, services] = await Promise.all([fetchPlots(ids), fetchTopServices(ids)]);
  return { titles: page.map((r) => toTitle(r, plots, services)), hasMore: offset + PAGE_SIZE < rows.length };
}

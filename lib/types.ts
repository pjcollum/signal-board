export type MediaType = "tv" | "film";
export type SortBy = "rating" | "popularity";

// IMDb's dataset only has a release year (no month/day), so this is the
// finest granularity "Popular" can actually filter by. Only used when
// sortBy === "popularity".
export type PopularWindow = "1" | "2" | "5" | "10" | "all";

export interface Title {
  id: string;        // IMDb tconst, e.g. "tt0903747"
  title: string;
  link: string;       // IMDb title page
  rating: number;      // IMDb averageRating (0–10)
  votes: number;       // IMDb numVotes — used as the "popularity" proxy
  year: number | null;
  genres: string[];
  summary: string | null; // one-sentence plot, via OMDb — null if unavailable
  service: string | null; // most well-known UK streaming service it's on, via Watchmode — null if unavailable
}

export interface BoardResult {
  titles: Title[];
  hasMore: boolean;
}

export type Entry =
  | { status: "loading" }
  | { status: "error"; message?: string }
  | ({ status: "done"; loadingMore?: boolean } & BoardResult);

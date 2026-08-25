"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Title, Entry, MediaType, PopularWindow, SortBy } from "@/lib/types";

// ── Data fetch ─────────────────────────────────────────────────────────
async function fetchBoard(
  mediaType: MediaType, sortBy: SortBy, docsOnly: boolean, popularWindow: PopularWindow, offset = 0
): Promise<{ titles: Title[]; hasMore: boolean }> {
  const res = await fetch("/api/board", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mediaType, sortBy, docsOnly, popularWindow, offset }),
  });
  if (!res.ok) {
    let msg = "request failed";
    try { const j = await res.json(); msg = j.detail || j.error || msg; } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as { titles: Title[]; hasMore: boolean };
}

const titleMetric = (t: Title, sb: SortBy) => (sb === "rating" ? t.rating : t.votes);

const WINDOW_LABEL: Record<PopularWindow, string> = {
  "1": "This year", "2": "Last 2 yrs", "5": "Last 5 yrs", "10": "Last 10 yrs", all: "All time",
};
const WINDOW_PHRASE: Record<PopularWindow, string> = {
  "1": "this year", "2": "the last 2 years", "5": "the last 5 years", "10": "the last 10 years", all: "any year",
};

// ── App ──────────────────────────────────────────────────────────────────
export default function SignalBoard() {
  const [mediaType, setMediaType] = useState<MediaType>("tv");
  const [sortBy, setSortBy] = useState<SortBy>("rating");
  const [docsOnly, setDocsOnly] = useState(false);
  const [popularWindow, setPopularWindow] = useState<PopularWindow>("5");
  const [entry, setEntry] = useState<Entry>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const runId = useRef(0);

  const shortDate = React.useMemo(
    () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase(), []);

  const load = useCallback((type: MediaType, sb: SortBy, docs: boolean, win: PopularWindow) => {
    const my = ++runId.current;
    setUpdatedAt(new Date());
    setLoadingMore(false);
    setEntry({ status: "loading" });
    fetchBoard(type, sb, docs, win)
      .then((r) => { if (runId.current === my) setEntry({ status: "done", ...r }); })
      .catch((err) => { if (runId.current === my) setEntry({ status: "error", message: String(err?.message || "") }); });
  }, []);

  const loadMore = useCallback(() => {
    if (entry.status !== "done" || !entry.hasMore || loadingMore) return;
    const my = runId.current;
    const offset = entry.titles.length;
    setLoadingMore(true);
    fetchBoard(mediaType, sortBy, docsOnly, popularWindow, offset)
      .then((r) => {
        if (runId.current !== my) return; // filters changed mid-flight — discard
        setEntry((e) => (e.status === "done" ? { status: "done", titles: [...e.titles, ...r.titles], hasMore: r.hasMore } : e));
      })
      .catch(() => { /* leave the current list as-is; the button just stays available to retry */ })
      .finally(() => { if (runId.current === my) setLoadingMore(false); });
  }, [entry, loadingMore, mediaType, sortBy, docsOnly, popularWindow]);

  useEffect(() => { load("tv", "rating", false, "5"); /* eslint-disable-next-line */ }, []);

  const setType = (t: MediaType) => { if (t === mediaType) return; setMediaType(t); load(t, sortBy, docsOnly, popularWindow); };
  const setSort = (sb: SortBy) => { if (sb === sortBy) return; setSortBy(sb); load(mediaType, sb, docsOnly, popularWindow); };
  const setDocs = (docs: boolean) => { if (docs === docsOnly) return; setDocsOnly(docs); load(mediaType, sortBy, docs, popularWindow); };
  const setWindow = (win: PopularWindow) => { if (win === popularWindow) return; setPopularWindow(win); load(mediaType, sortBy, docsOnly, win); };

  const loading = entry.status === "loading";
  const titles = entry.status === "done" ? entry.titles : [];

  return (
    <div className="board">
      <div className="scanlines" aria-hidden="true" />

      <header className="masthead">
        <div className="eyebrow">
          <span className={"live" + (loading ? " pulsing" : "")} />
          {shortDate} &middot; {loading ? "TUNING IN…" : "ON AIR"}
        </div>
        <h1 className="wordmark">SIGNAL BOARD</h1>
        <p className="dek">
          The best-rated {docsOnly ? "documentaries" : mediaType === "tv" ? "TV shows" : "films"} on IMDb
          {sortBy === "popularity" ? `, from ${WINDOW_PHRASE[popularWindow]}, ranked by vote count` : ""} —
          the shortlist worth hunting down on Plex.
        </p>
      </header>

      <div className="controls">
        <div className="seg" role="tablist" aria-label="Media type">
          <button role="tab" aria-selected={mediaType === "tv"} className={mediaType === "tv" ? "on" : ""} onClick={() => setType("tv")}>TV shows</button>
          <button role="tab" aria-selected={mediaType === "film"} className={mediaType === "film" ? "on" : ""} onClick={() => setType("film")}>Films</button>
        </div>

        <div className="seg" role="tablist" aria-label="Sort by">
          {(["rating", "popularity"] as SortBy[]).map((sb) => (
            <button key={sb} role="tab" aria-selected={sortBy === sb} className={sortBy === sb ? "on" : ""} onClick={() => setSort(sb)}>
              {sb === "rating" ? "Rating" : "Popular"}
            </button>
          ))}
        </div>

        {sortBy === "popularity" ? (
          <div className="seg" role="tablist" aria-label="Popular duration">
            {(["1", "2", "5", "10", "all"] as PopularWindow[]).map((w) => (
              <button key={w} role="tab" aria-selected={popularWindow === w} className={popularWindow === w ? "on" : ""} onClick={() => setWindow(w)}>
                {WINDOW_LABEL[w]}
              </button>
            ))}
          </div>
        ) : null}

        <div className="seg" role="tablist" aria-label="Documentaries">
          <button role="tab" aria-selected={docsOnly} className={docsOnly ? "on" : ""} onClick={() => setDocs(!docsOnly)}>
            Docs
          </button>
        </div>

        <button className="refresh" onClick={() => load(mediaType, sortBy, docsOnly, popularWindow)} disabled={loading}>
          {loading ? "Tuning…" : "Refresh"}
        </button>
      </div>

      <section className="overall">
        <div className="ohead">
          <span className="oeyebrow">◆ IMDb &middot; non-commercial dataset</span>
          <h2>Top rated</h2>
          <p className="osub">
            {sortBy === "popularity"
              ? `The most-watched ${docsOnly ? "documentaries" : mediaType === "tv" ? "shows" : "films"} from ${WINDOW_PHRASE[popularWindow]}, by IMDb vote count.`
              : `The highest IMDb-rated ${docsOnly ? "documentaries" : mediaType === "tv" ? "shows" : "films"} of all time, with enough votes to be trustworthy.`}
          </p>
        </div>

        {entry.status === "error" ? (
          <div className="err">
            <p>Couldn&apos;t load the board{entry.message ? ` — ${entry.message}` : ""}.</p>
            <button className="retry" onClick={() => load(mediaType, sortBy, docsOnly, popularWindow)}>Try again</button>
          </div>
        ) : loading ? (
          <ol className="olist">
            {[0, 1, 2, 3, 4].map((i) => (
              <li className="orow skel" key={i}>
                <span className="orank">{i + 1}</span>
                <div className="omain"><span className="sk sk-title" /><span className="sk sk-meta" /></div>
                <span className="sk sk-imdb" />
              </li>
            ))}
          </ol>
        ) : titles.length === 0 ? (
          <p className="otally">No results.</p>
        ) : (
          <ol className="olist">
            {titles.map((t, i) => (
              <li className="orow" key={t.id}>
                <span className="orank">{i + 1}</span>
                <div className="omain">
                  <a className="otitle" href={t.link} target="_blank" rel="noreferrer">
                    {t.title}<span className="ext" aria-hidden="true">↗</span>
                  </a>
                  <div className="ometa">
                    {t.year ? <span>{t.year}</span> : null}
                    {t.genres.length ? <span className="dotsep">{t.genres.join(", ")}</span> : null}
                  </div>
                  {t.service ? <span className="svcbadge">{t.service}</span> : null}
                  {t.summary ? <p className="osummary">{t.summary}</p> : null}
                </div>
                <div className="oratings">
                  <span className="oimdb">{sortBy === "popularity" ? titleMetric(t, sortBy).toLocaleString() : t.rating.toFixed(1)}</span>
                  <span className="scorelbl">{sortBy === "popularity" ? "votes" : "IMDb"}</span>
                </div>
              </li>
            ))}
          </ol>
        )}

        {entry.status === "done" && entry.hasMore ? (
          <div className="loadmore-wrap">
            <button className="retry" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load 10 more"}
            </button>
          </div>
        ) : null}
      </section>

      <footer className="foot">
        <p>
          Ranked from IMDb&apos;s public non-commercial datasets. This product uses IMDb data but is not endorsed or
          certified by IMDb. Streaming flags are UK availability via Watchmode and may lag reality — treat them as a
          lead, not gospel.{updatedAt ? " Updated " + updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + "." : ""}
        </p>
      </footer>
    </div>
  );
}

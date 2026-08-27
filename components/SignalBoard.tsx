"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Title, Entry, MediaType, PopularWindow, SortBy } from "@/lib/types";

// ── Data fetch ─────────────────────────────────────────────────────────
async function fetchBoard(
  mediaType: MediaType,
  sortBy: SortBy,
  docsOnly: boolean,
  popularWindow: PopularWindow,
  offset = 0,
): Promise<{ titles: Title[]; hasMore: boolean }> {
  const res = await fetch("/api/board", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mediaType, sortBy, docsOnly, popularWindow, offset }),
  });
  if (!res.ok) {
    let msg = "request failed";
    try {
      const j = await res.json();
      msg = j.detail || j.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as { titles: Title[]; hasMore: boolean };
}

const titleMetric = (t: Title, sb: SortBy) => (sb === "rating" ? t.rating : t.votes);

const WINDOW_LABEL: Record<PopularWindow, string> = {
  "1": "This year",
  "2": "Last 2 yrs",
  "5": "Last 5 yrs",
  "10": "Last 10 yrs",
  all: "All time",
};
const WINDOW_PHRASE: Record<PopularWindow, string> = {
  "1": "this year",
  "2": "the last 2 years",
  "5": "the last 5 years",
  "10": "the last 10 years",
  all: "any year",
};

// ── App ──────────────────────────────────────────────────────────────────
export default function SignalBoard() {
  const [mediaType, setMediaType] = useState<MediaType>("tv");
  const [sortBy, setSortBy] = useState<SortBy>("popularity");
  const [docsOnly, setDocsOnly] = useState(false);
  const [popularWindow, setPopularWindow] = useState<PopularWindow>("1");
  const [entry, setEntry] = useState<Entry>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const runId = useRef(0);

  const shortDate = React.useMemo(
    () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase(),
    [],
  );

  const load = useCallback((type: MediaType, sb: SortBy, docs: boolean, win: PopularWindow) => {
    const my = ++runId.current;
    setUpdatedAt(new Date());
    setLoadingMore(false);
    setEntry({ status: "loading" });
    fetchBoard(type, sb, docs, win)
      .then((r) => {
        if (runId.current === my) setEntry({ status: "done", ...r });
      })
      .catch((err) => {
        if (runId.current === my)
          setEntry({ status: "error", message: String(err?.message || "") });
      });
  }, []);

  const loadMore = useCallback(() => {
    if (entry.status !== "done" || !entry.hasMore || loadingMore) return;
    const my = runId.current;
    const offset = entry.titles.length;
    setLoadingMore(true);
    fetchBoard(mediaType, sortBy, docsOnly, popularWindow, offset)
      .then((r) => {
        if (runId.current !== my) return; // filters changed mid-flight — discard
        setEntry((e) =>
          e.status === "done"
            ? { status: "done", titles: [...e.titles, ...r.titles], hasMore: r.hasMore }
            : e,
        );
      })
      .catch(() => {
        /* leave the current list as-is; the button just stays available to retry */
      })
      .finally(() => {
        if (runId.current === my) setLoadingMore(false);
      });
  }, [entry, loadingMore, mediaType, sortBy, docsOnly, popularWindow]);

  useEffect(() => {
    load("tv", "popularity", false, "1"); /* eslint-disable-next-line */
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const viewport = window.innerHeight;
      const threshold = Math.max(250, viewport * 0.5);
      const full = document.documentElement.scrollHeight;
      const scrollable = full > viewport + threshold;
      const nearBottom = full - (window.scrollY + viewport) < threshold;
      setShowBackToTop(scrollable && nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const scrollToTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const onRadioGroupKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const nav: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
    if (!(e.key in nav) && e.key !== "Home" && e.key !== "End") return;
    const radios = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    if (!radios.length) return;
    const current = radios.indexOf(document.activeElement as HTMLButtonElement);
    let next = current;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = radios.length - 1;
    else next = current === -1 ? 0 : (current + nav[e.key] + radios.length) % radios.length;
    e.preventDefault();
    radios[next].focus();
    radios[next].click();
  };

  const setType = (t: MediaType) => {
    if (t === mediaType) return;
    setMediaType(t);
    load(t, sortBy, docsOnly, popularWindow);
  };
  const setSort = (sb: SortBy) => {
    if (sb === sortBy) return;
    setSortBy(sb);
    load(mediaType, sb, docsOnly, popularWindow);
  };
  const setDocs = (docs: boolean) => {
    if (docs === docsOnly) return;
    setDocsOnly(docs);
    load(mediaType, sortBy, docs, popularWindow);
  };
  const setWindow = (win: PopularWindow) => {
    if (win === popularWindow) return;
    setPopularWindow(win);
    load(mediaType, sortBy, docsOnly, win);
  };

  const loading = entry.status === "loading";
  const titles = entry.status === "done" ? entry.titles : [];

  return (
    <div className="board">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="scanlines" aria-hidden="true" />

      <header className="masthead">
        <div className="eyebrow">
          <span className={"live" + (loading ? " pulsing" : "")} />
          {shortDate} &middot; {loading ? "TUNING IN…" : "ON AIR"}
        </div>
        <h1 className="wordmark">SIGNAL BOARD</h1>
        <p className="dek">
          The best-rated {docsOnly ? "documentaries" : mediaType === "tv" ? "TV shows" : "films"} on
          IMDb
          {sortBy === "popularity"
            ? `, from ${WINDOW_PHRASE[popularWindow]}, ranked by vote count`
            : ""}{" "}
          — the shortlist worth hunting down on Plex.
        </p>
      </header>

      <div className="controls">
        <div
          className="seg"
          role="radiogroup"
          aria-label="Media type"
          onKeyDown={onRadioGroupKeyDown}
        >
          <button
            role="radio"
            aria-checked={mediaType === "tv"}
            tabIndex={mediaType === "tv" ? 0 : -1}
            className={mediaType === "tv" ? "on" : ""}
            onClick={() => setType("tv")}
          >
            TV shows
          </button>
          <button
            role="radio"
            aria-checked={mediaType === "film"}
            tabIndex={mediaType === "film" ? 0 : -1}
            className={mediaType === "film" ? "on" : ""}
            onClick={() => setType("film")}
          >
            Films
          </button>
        </div>

        <div className="seg" role="radiogroup" aria-label="Sort by" onKeyDown={onRadioGroupKeyDown}>
          {(["rating", "popularity"] as SortBy[]).map((sb) => (
            <button
              key={sb}
              role="radio"
              aria-checked={sortBy === sb}
              tabIndex={sortBy === sb ? 0 : -1}
              className={sortBy === sb ? "on" : ""}
              onClick={() => setSort(sb)}
            >
              {sb === "rating" ? "Rating" : "Popular"}
            </button>
          ))}
        </div>

        {sortBy === "popularity" ? (
          <div
            className="seg"
            role="radiogroup"
            aria-label="Popular duration"
            onKeyDown={onRadioGroupKeyDown}
          >
            {(["1", "2", "5", "10", "all"] as PopularWindow[]).map((w) => (
              <button
                key={w}
                role="radio"
                aria-checked={popularWindow === w}
                tabIndex={popularWindow === w ? 0 : -1}
                className={popularWindow === w ? "on" : ""}
                onClick={() => setWindow(w)}
              >
                {WINDOW_LABEL[w]}
              </button>
            ))}
          </div>
        ) : null}

        <div className="seg" role="group" aria-label="Documentaries">
          <button
            aria-pressed={docsOnly}
            className={docsOnly ? "on" : ""}
            onClick={() => setDocs(!docsOnly)}
          >
            Docs
          </button>
        </div>

        <button
          className="refresh"
          onClick={() => load(mediaType, sortBy, docsOnly, popularWindow)}
          disabled={loading}
        >
          {loading ? "Tuning…" : "Refresh"}
        </button>
      </div>

      <main id="main-content" tabIndex={-1}>
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

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {loading
              ? "Loading rankings…"
              : entry.status === "done"
                ? `${titles.length} titles loaded.`
                : ""}
          </p>

          {entry.status === "error" ? (
            <div className="err" role="alert">
              <p>Couldn&apos;t load the board{entry.message ? ` — ${entry.message}` : ""}.</p>
              <button
                className="retry"
                onClick={() => load(mediaType, sortBy, docsOnly, popularWindow)}
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <ol className="olist">
              {[0, 1, 2, 3, 4].map((i) => (
                <li className="orow skel" key={i}>
                  <span className="orank">{i + 1}</span>
                  <div className="omain">
                    <span className="sk sk-title" />
                    <span className="sk sk-meta" />
                  </div>
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
                      {t.title}
                      <span className="sr-only"> (opens in new tab)</span>
                      <span className="ext" aria-hidden="true">
                        ↗
                      </span>
                    </a>
                    <div className="ometa">
                      {t.year ? <span>{t.year}</span> : null}
                      {t.genres.length ? (
                        <span className="dotsep">{t.genres.join(", ")}</span>
                      ) : null}
                    </div>
                    {t.service ? <span className="svcbadge">{t.service}</span> : null}
                    {t.summary ? <p className="osummary">{t.summary}</p> : null}
                  </div>
                  <div className="oratings">
                    <span className="oimdb">
                      {sortBy === "popularity"
                        ? titleMetric(t, sortBy).toLocaleString()
                        : t.rating.toFixed(1)}
                    </span>
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
      </main>

      <footer className="foot">
        <p>
          Ranked from IMDb&apos;s public non-commercial datasets. This product uses IMDb data but is
          not endorsed or certified by IMDb. Streaming flags are UK availability via Watchmode and
          may lag reality — treat them as a lead, not gospel.
          {updatedAt
            ? " Updated " +
              updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) +
              "."
            : ""}
        </p>
      </footer>

      <button
        type="button"
        className={"backtotop" + (showBackToTop ? " show" : "")}
        onClick={scrollToTop}
        aria-label="Back to top"
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
      >
        ↑
      </button>
    </div>
  );
}

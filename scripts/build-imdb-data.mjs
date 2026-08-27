#!/usr/bin/env node
// Downloads IMDb's free non-commercial datasets (datasets.imdbws.com) and
// bakes a filtered, joined snapshot into lib/imdb-data.json for the app to
// query in-memory. No API key involved — these are public TSV dumps.
//
// Run with: npm run build:imdb
// Re-run periodically to refresh (IMDb updates the source files daily).

import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "lib", "imdb-data.json");

const RATINGS_URL = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const BASICS_URL = "https://datasets.imdbws.com/title.basics.tsv.gz";

// Titles below this vote count are noise (obscure/foreign shorts etc.) and
// would just bloat the bundle without being anything worth surfacing.
const MIN_VOTES = 1000;

const TYPE_MAP = { movie: "film", tvSeries: "tv", tvMiniSeries: "tv" };

async function streamLines(url, onLine) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const gunzip = createGunzip();
  Readable.fromWeb(res.body).pipe(gunzip);
  const rl = createInterface({ input: gunzip, crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      continue;
    } // header
    onLine(line);
  }
}

async function main() {
  console.log("Downloading + parsing title.ratings.tsv.gz ...");
  const ratings = new Map();
  await streamLines(RATINGS_URL, (line) => {
    const [tconst, avg, votes] = line.split("\t");
    ratings.set(tconst, { rating: Number(avg), votes: Number(votes) });
  });
  console.log(`  ${ratings.size.toLocaleString()} rated titles`);

  console.log("Downloading + parsing title.basics.tsv.gz (this is the big one, ~225MB) ...");
  const out = [];
  let seen = 0;
  await streamLines(BASICS_URL, (line) => {
    seen++;
    const [tconst, titleType, primaryTitle, , isAdult, startYear, , , genresRaw] = line.split("\t");
    const type = TYPE_MAP[titleType];
    if (!type) return;
    if (isAdult === "1") return;
    if (genresRaw === "\\N" || !genresRaw) return;
    const r = ratings.get(tconst);
    if (!r || r.votes < MIN_VOTES) return;
    out.push({
      id: tconst,
      title: primaryTitle,
      type,
      year: startYear === "\\N" ? null : Number(startYear),
      genres: genresRaw.split(","),
      rating: r.rating,
      votes: r.votes,
    });
  });
  console.log(`  scanned ${seen.toLocaleString()} titles, kept ${out.length.toLocaleString()}`);

  out.sort((a, b) => b.votes - a.votes);
  writeFileSync(OUT_PATH, JSON.stringify(out));
  console.log(`Wrote ${OUT_PATH} (${(JSON.stringify(out).length / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

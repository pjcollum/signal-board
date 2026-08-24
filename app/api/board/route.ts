import { NextRequest, NextResponse } from "next/server";
import { fetchBoard } from "@/lib/board";
import type { MediaType, PopularWindow, SortBy } from "@/lib/types";

export const runtime = "nodejs";

const POPULAR_WINDOWS: PopularWindow[] = ["1", "2", "5", "10", "all"];

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mediaType: MediaType = body?.mediaType === "film" ? "film" : "tv";
  const sortBy: SortBy = body?.sortBy === "popularity" ? "popularity" : "rating";
  const docsOnly: boolean = body?.docsOnly === true;
  const popularWindow: PopularWindow = POPULAR_WINDOWS.includes(body?.popularWindow) ? body.popularWindow : "5";
  const offset: number = Number.isInteger(body?.offset) && body.offset >= 0 ? body.offset : 0;

  try {
    const result = await fetchBoard(mediaType, sortBy, docsOnly, popularWindow, offset);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Request failed", detail: String(e?.message || e).slice(0, 300) },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { readPaperManifest } from "@/lib/server/paperManifest";

export const dynamic = "force-dynamic";

export async function GET() {
  const manifest = await readPaperManifest();
  const papers = manifest.papers.map(({ sourcePath: _sourcePath, ...paper }) => paper);
  return NextResponse.json({ ...manifest, papers });
}

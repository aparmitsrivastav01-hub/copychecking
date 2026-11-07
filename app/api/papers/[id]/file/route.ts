import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { readPaperManifest } from "@/lib/server/paperManifest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const manifest = await readPaperManifest();
  const paper = manifest.papers.find((item) => item.id === id);
  if (!paper?.sourcePath) return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  try {
    const bytes = await readFile(paper.sourcePath);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const safeName = paper.filename.replace(/[\r\n"\\]/g, "_");
    return new NextResponse(bytes, { headers: {
      "Content-Type": paper.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
    } });
  } catch { return NextResponse.json({ error: "Source file is unavailable. Rebuild the local paper index." }, { status: 404 }); }
}

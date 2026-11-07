import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PaperManifest } from "@/lib/models";

const manifestPath = path.join(process.cwd(), "data", "papers-manifest.json");
export async function readPaperManifest(): Promise<PaperManifest> {
  try { return JSON.parse(await readFile(manifestPath, "utf8")) as PaperManifest; }
  catch { return { generatedAt: new Date().toISOString(), sourceDirectory: process.env.PAPERCHECK_PAPERS_DIR ?? "", papers: [], unreadableFiles: [] }; }
}

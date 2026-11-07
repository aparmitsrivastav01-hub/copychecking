import type { PaperManifest, PaperRecord } from "@/lib/models";

export async function listPapers(): Promise<PaperManifest> {
  const response = await fetch("/api/papers", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the indexed paper catalogue.");
  return response.json() as Promise<PaperManifest>;
}

export async function getPaperById(id: string): Promise<PaperRecord | null> {
  const manifest = await listPapers();
  return manifest.papers.find((paper) => paper.id === id) ?? null;
}

export function getPaperFileUrl(paper: { id: string }, download = false): string {
  return `/api/papers/${encodeURIComponent(paper.id)}/file${download ? "?download=1" : ""}`;
}

export function filterPapers(
  papers: PaperRecord[],
  options: { query?: string; type?: string; format?: string }
): PaperRecord[] {
  const query = (options.query ?? "").trim().toLowerCase();
  const type = options.type ?? "all";
  const format = options.format ?? "all";

  return papers.filter((paper) => {
    if (query) {
      const matchTitle = paper.title.toLowerCase().includes(query);
      const matchFilename = paper.filename.toLowerCase().includes(query);
      const matchYear = paper.year ? String(paper.year).includes(query) : false;
      const matchSubject = paper.subject ? paper.subject.toLowerCase().includes(query) : false;
      const matchType = paper.paperType ? paper.paperType.toLowerCase().includes(query) : false;
      if (!matchTitle && !matchFilename && !matchYear && !matchSubject && !matchType) return false;
    }

    if (type !== "all") {
      if (type === "question_paper") {
        if (paper.kind !== "question_paper") return false;
      } else if (type === "study_material") {
        if (paper.kind === "question_paper") return false;
      } else if (paper.paperType?.toLowerCase() !== type.toLowerCase()) {
        return false;
      }
    }

    if (format !== "all" && paper.format.toLowerCase() !== format.toLowerCase()) {
      return false;
    }

    return true;
  });
}

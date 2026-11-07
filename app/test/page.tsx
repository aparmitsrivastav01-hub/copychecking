"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileSearch,
  FileText,
  Filter,
  Layers,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AppNav, PageIntro } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import {
  filterPapers,
  getPaperFileUrl,
  listPapers,
} from "@/lib/repositories/paperRepository";
import { startAttempt } from "@/lib/repositories/localRepository";
import type { PaperManifest, PaperRecord } from "@/lib/models";

function TestCatalogueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPaperId = searchParams.get("paper");
  const { update } = useApp();

  const [manifest, setManifest] = useState<PaperManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(initialPaperId);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [previewPaper, setPreviewPaper] = useState<PaperRecord | null>(null);

  useEffect(() => {
    listPapers()
      .then((data) => {
        setManifest(data);
        if (data.papers.length > 0) {
          const matched = initialPaperId
            ? data.papers.find((p) => p.id === initialPaperId)
            : null;
          setSelectedPaperId(matched ? matched.id : data.papers[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load paper catalogue. Please make sure the paper indexing script has run.");
        setLoading(false);
      });
  }, [initialPaperId]);

  const allPapers = manifest?.papers ?? [];

  // Available paper types for filter chips
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    for (const p of allPapers) {
      if (p.kind === "question_paper") {
        types.add("Question paper");
      } else if (p.paperType) {
        types.add(p.paperType);
      } else {
        types.add("Study material");
      }
    }
    return Array.from(types);
  }, [allPapers]);

  // Filtered papers based on search and type
  const filteredPapers = useMemo(() => {
    return filterPapers(allPapers, {
      query: searchQuery,
      type: typeFilter === "all" ? undefined : typeFilter,
    });
  }, [allPapers, searchQuery, typeFilter]);

  const selectedPaper = useMemo(
    () => allPapers.find((p) => p.id === selectedPaperId) ?? filteredPapers[0] ?? null,
    [allPapers, selectedPaperId, filteredPapers]
  );

  const handleStartTest = (paper: PaperRecord) => {
    const attempt = startAttempt(paper.id, paper.durationMinutes ?? 180);
    update({
      selectedPaperId: paper.id,
      currentAttemptId: attempt.id,
      examStartedAt: Date.now(),
      examRemaining: (paper.durationMinutes ?? 180) * 60,
      examAnswers: {},
      uploadedNames: [],
    });
    router.push("/exam");
  };

  return (
    <main className="app-frame">
      <AppNav active="/test" />
      <div className="app-content narrow-content">
        <PageIntro
          eyebrow="STEP 01 · CBSE CLASS 12 COMPUTER SCIENCE"
          title="PAPER CATALOGUE."
          description="Browse actual board question papers and indexed materials discovered from your local directory."
          action={
            selectedPaper && selectedPaper.kind === "question_paper" ? (
              <button
                className="button button-gold"
                onClick={() => handleStartTest(selectedPaper)}
              >
                Start This Test <ArrowRight size={14} />
              </button>
            ) : undefined
          }
        />

        {/* Search & Filter Toolbar */}
        <section
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "16px",
            marginBottom: "16px",
            padding: "14px 16px",
            background: "rgba(255,255,255,0.015)",
            border: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flex: "1 1 240px",
              background: "#0d0d0c",
              border: "1px solid var(--line)",
              padding: "0 12px",
              minHeight: "36px",
            }}
          >
            <Search size={14} style={{ color: "var(--gold)" }} />
            <input
              type="text"
              placeholder="Search by paper title, code, year, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--white)",
                fontSize: "11px",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "9px",
                color: "var(--muted)",
                marginRight: "4px",
                fontWeight: "bold",
                letterSpacing: "0.1em",
              }}
            >
              <Filter size={11} style={{ color: "var(--gold)" }} /> FILTER:
            </span>
            <button
              className={`subject-chip ${typeFilter === "all" ? "chosen" : ""}`}
              onClick={() => setTypeFilter("all")}
            >
              All ({allPapers.length})
            </button>
            {availableTypes.map((type) => (
              <button
                key={type}
                className={`subject-chip ${typeFilter === type ? "chosen" : ""}`}
                onClick={() => setTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </section>

        {loading && (
          <div className="upload-empty" style={{ padding: "48px 0" }}>
            <FileSearch size={24} style={{ color: "var(--gold)" }} />
            <b style={{ marginTop: "12px" }}>Scanning catalogue...</b>
            <p>Loading papers from local manifest.</p>
          </div>
        )}

        {error && (
          <div className="upload-error" style={{ padding: "14px", border: "1px solid var(--red)" }}>
            {error}
          </div>
        )}

        {!loading && !error && filteredPapers.length === 0 && (
          <div className="upload-empty" style={{ padding: "48px 0", border: "1px dashed var(--line)" }}>
            <BookOpen size={24} style={{ color: "var(--gold)" }} />
            <b style={{ marginTop: "12px" }}>No papers match your search criteria.</b>
            <p>Try clearing filters or running the ingestion script if new files were added.</p>
            {searchQuery && (
              <button
                className="button button-outline"
                style={{ marginTop: "14px" }}
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                }}
              >
                Reset Search
              </button>
            )}
          </div>
        )}

        {/* Paper Grid */}
        {!loading && filteredPapers.length > 0 && (
          <section className="selector-section" style={{ marginTop: "12px" }}>
            <div className="selector-heading">
              <span className="brand-mark" style={{ width: "22px", height: "22px" }}>
                <Layers size={12} />
              </span>
              <div>
                <b>CHOOSE A QUESTION PAPER OR STUDY MATERIAL</b>
                <small>
                  {filteredPapers.length} of {allPapers.length} indexed file(s) available
                </small>
              </div>
            </div>

            <div className="select-paper-grid">
              {filteredPapers.map((paper) => {
                const isSelected = selectedPaper?.id === paper.id;
                return (
                  <article
                    key={paper.id}
                    className={`select-paper-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setSelectedPaperId(paper.id)}
                  >
                    <div className="select-card-top">
                      <span className="paper-tag">
                        {paper.paperType?.toUpperCase() ?? "QUESTION PAPER"} · {paper.format.toUpperCase()}
                      </span>
                      <div className={isSelected ? "selected-check" : "unselected-ring"}>
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </div>
                    <span className="select-subject">
                      {paper.subject ?? "Computer Science"} <i>· Class {paper.grade ?? 12}</i>
                    </span>
                    <b>{paper.title}</b>
                    <div className="select-paper-meta">
                      <span>
                        <Clock3 size={11} /> {paper.durationMinutes === null ? "Duration unknown" : `${paper.durationMinutes} min`}
                      </span>
                      <span>
                        <FileText size={11} /> {paper.maximumMarks === null ? "Marks unknown" : `${paper.maximumMarks} marks`}
                      </span>
                      <span>
                        <Calendar size={11} /> {paper.year === null ? "Year unknown" : paper.year}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginTop: "12px",
                        paddingTop: "10px",
                        borderTop: "1px solid var(--line)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="button button-outline button-small"
                        onClick={() => setPreviewPaper(paper)}
                        title="Preview paper content"
                      >
                        <Eye size={12} /> Preview
                      </button>
                      <a
                        href={getPaperFileUrl(paper)}
                        target="_blank"
                        rel="noreferrer"
                        className="button button-outline button-small"
                        title="Open document in new tab"
                      >
                        <ExternalLink size={12} /> Open
                      </a>
                      <a
                        href={getPaperFileUrl(paper, true)}
                        className="button button-outline button-small"
                        title="Download original file"
                      >
                        <Download size={12} /> Download
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Selected Paper Details Brief */}
        {selectedPaper && (
          <section className="exam-brief">
            <div className="brief-head">
              <Sparkles size={16} />
              <div>
                <b>SELECTED PAPER SPECIFICATION & DETAILS</b>
                <span>Verified metadata from local document stream</span>
              </div>
            </div>

            <div className="brief-grid">
              <span>
                <i>01</i>
                <div>
                  <strong>Paper Title & Code</strong>
                  <br />
                  {selectedPaper.title}
                </div>
              </span>
              <span>
                <i>02</i>
                <div>
                  <strong>Format & Origin</strong>
                  <br />
                  {selectedPaper.format.toUpperCase()} document · {selectedPaper.filename}
                  {selectedPaper.pageCount ? ` (${selectedPaper.pageCount} pages)` : ""}
                </div>
              </span>
              <span>
                <i>03</i>
                <div>
                  <strong>Marks & Allotted Time</strong>
                  <br />
                  Maximum Marks: {selectedPaper.maximumMarks === null ? "Unknown" : `${selectedPaper.maximumMarks} marks`} ·
                  Duration: {selectedPaper.durationMinutes === null ? "Unknown" : `${selectedPaper.durationMinutes} minutes`}
                </div>
              </span>
              <span>
                <i>04</i>
                <div>
                  <strong>Academic Year & Session</strong>
                  <br />
                  Session: {selectedPaper.academicSession ?? "Unknown"} ·
                  Year: {selectedPaper.year ?? "Unknown"}
                </div>
              </span>
            </div>

            <div className="brief-footer">
              <div>
                <span>AUTHENTIC LOCAL SOURCE</span>
                <b>{selectedPaper.relativePath}</b>
                <small>
                  Indexed on {new Date(selectedPaper.indexedAt).toLocaleDateString()}
                  <i>·</i>
                  {selectedPaper.sizeBytes ? `${(selectedPaper.sizeBytes / 1024).toFixed(0)} KB` : "Original preserved"}
                </small>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="button button-outline"
                  onClick={() => setPreviewPaper(selectedPaper)}
                >
                  <Eye size={13} /> View Preview
                </button>
                {selectedPaper.kind === "question_paper" ? (
                  <button
                    className="button button-gold"
                    onClick={() => handleStartTest(selectedPaper)}
                  >
                    Start Test Against The Clock <ArrowRight size={14} />
                  </button>
                ) : (
                  <a
                    href={getPaperFileUrl(selectedPaper)}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-gold"
                  >
                    Open Document <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Paper Preview Modal */}
        {previewPaper && (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreviewPaper(null);
            }}
          >
            <div
              className="submit-modal"
              style={{
                width: "min(860px, 94vw)",
                maxHeight: "88vh",
                display: "flex",
                flexDirection: "column",
                padding: "24px",
              }}
              role="dialog"
              aria-modal="true"
            >
              <button
                className="modal-close"
                onClick={() => setPreviewPaper(null)}
                aria-label="Close preview"
              >
                ×
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <span className="brand-mark" style={{ width: "26px", height: "26px" }}>
                  <FileText size={14} />
                </span>
                <div>
                  <div className="eyebrow">
                    <span /> {previewPaper.paperType?.toUpperCase() ?? "DOCUMENT"} PREVIEW
                  </div>
                  <h2 style={{ margin: "2px 0 0", fontSize: "20px" }}>{previewPaper.title}</h2>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  fontSize: "9px",
                  color: "var(--muted)",
                  paddingBottom: "12px",
                  borderBottom: "1px solid var(--line)",
                  marginBottom: "14px",
                }}
              >
                <span>
                  <b>Format:</b> {previewPaper.format.toUpperCase()}
                </span>
                <span>
                  <b>Marks:</b> {previewPaper.maximumMarks ?? "Unknown"}
                </span>
                <span>
                  <b>Duration:</b> {previewPaper.durationMinutes ? `${previewPaper.durationMinutes}m` : "Unknown"}
                </span>
                <span>
                  <b>Pages:</b> {previewPaper.pageCount ?? "Unknown"}
                </span>
              </div>

              {/* Embedded Document or Preview Text */}
              <div
                style={{
                  flex: "1 1 auto",
                  overflow: "auto",
                  background: "#050505",
                  border: "1px solid var(--line)",
                  padding: "16px",
                  minHeight: "360px",
                }}
              >
                {previewPaper.format === "pdf" ? (
                  <iframe
                    src={getPaperFileUrl(previewPaper)}
                    title={previewPaper.title}
                    style={{
                      width: "100%",
                      height: "460px",
                      border: "none",
                      background: "#fff",
                    }}
                  />
                ) : previewPaper.previewText ? (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      lineHeight: "1.6",
                      color: "#dfddd6",
                      margin: 0,
                    }}
                  >
                    {previewPaper.previewText}
                  </pre>
                ) : (
                  <div className="upload-empty">
                    <FileText size={24} />
                    <p style={{ marginTop: "10px" }}>No text preview available for this document.</p>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "16px",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", gap: "8px" }}>
                  <a
                    href={getPaperFileUrl(previewPaper)}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-outline button-small"
                  >
                    <ExternalLink size={12} /> Full Screen
                  </a>
                  <a
                    href={getPaperFileUrl(previewPaper, true)}
                    className="button button-outline button-small"
                  >
                    <Download size={12} /> Download Original
                  </a>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="button button-outline button-small"
                    onClick={() => setPreviewPaper(null)}
                  >
                    Close
                  </button>
                  {previewPaper.kind === "question_paper" && (
                    <button
                      className="button button-gold button-small"
                      onClick={() => {
                        setPreviewPaper(null);
                        handleStartTest(previewPaper);
                      }}
                    >
                      Start Test <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="app-footnote">
          CBSE CLASS 12 · COMPUTER SCIENCE <span>·</span> ACTUAL PAPERS FROM DISK
        </div>
      </div>
    </main>
  );
}

export default function TestPage() {
  return (
    <Suspense
      fallback={
        <main className="app-frame">
          <AppNav active="/test" />
          <div className="app-content narrow-content" style={{ padding: "60px 0", textAlign: "center" }}>
            <div className="eyebrow"><span /> LOADING</div>
            <h1 style={{ fontSize: "28px", marginTop: "12px" }}>LOADING CATALOGUE...</h1>
          </div>
        </main>
      }
    >
      <TestCatalogueContent />
    </Suspense>
  );
}

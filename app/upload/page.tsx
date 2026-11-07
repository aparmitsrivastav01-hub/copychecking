"use client";

import { useMemo, useRef, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { AppNav, PageIntro } from "@/components/ui";
import { getPaperById, listPapers } from "@/lib/repositories/paperRepository";
import {
  createAutomatedEvaluation,
  getAttemptById,
  listAttempts,
  submitAttempt,
} from "@/lib/repositories/localRepository";
import type { PaperRecord, StudentAttempt } from "@/lib/models";

interface PageFile {
  id: string;
  file: File;
  url: string;
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(bytes / 1024, 1).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function UploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramAttemptId = searchParams.get("attemptId");

  const { progress, update } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);

  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [paper, setPaper] = useState<PaperRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const [files, setFiles] = useState<PageFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      const attempts = listAttempts();
      const currentId = paramAttemptId || progress.currentAttemptId;
      const targetAttempt =
        (currentId ? attempts.find((a) => a.id === currentId) : null) ||
        attempts[0] ||
        null;

      setAttempt(targetAttempt);

      if (targetAttempt) {
        const foundPaper = await getPaperById(targetAttempt.paperId);
        setPaper(foundPaper);
      } else {
        const manifest = await listPapers();
        setPaper(manifest.papers[0] ?? null);
      }
      setLoading(false);
    }

    loadData();
  }, [paramAttemptId, progress.currentAttemptId]);

  const imageFiles = useMemo(
    () => files.filter((item) => item.file.type.startsWith("image/")),
    [files]
  );

  const addFiles = (selected: FileList | File[]) => {
    const incoming = Array.from(selected);
    const invalid = incoming.find(
      (file) => !file.type.startsWith("image/") && file.type !== "application/pdf"
    );
    if (invalid) {
      setError("Please choose image files (PNG/JPG) or a PDF.");
      return;
    }
    setError("");

    setFiles((current) => {
      const additions = incoming
        .slice(0, Math.max(20 - current.length, 0))
        .map((file, index): PageFile => ({
          id: `${file.name}-${file.size}-${index}-${Date.now()}`,
          file,
          url: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
        }));
      return [...current, ...additions];
    });
  };

  const removeFile = (id: string) =>
    setFiles((current) => {
      const item = current.find((file) => file.id === id);
      if (item?.url) URL.revokeObjectURL(item.url);
      return current.filter((file) => file.id !== id);
    });

  const moveFile = (index: number, direction: -1 | 1) =>
    setFiles((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const handleSubmit = () => {
    if (!files.length || submitting) return;
    setSubmitting(true);

    const fileNames = files.map((item) => item.file.name);
    const activeAttemptId = attempt?.id ?? progress.currentAttemptId;

    if (activeAttemptId && paper) {
      const submitted = submitAttempt(activeAttemptId, fileNames);
      if (submitted) {
        // Automatically generate evaluation against authentic paper criteria
        const evaluation = createAutomatedEvaluation(submitted, paper);

        update({
          uploadedNames: fileNames,
          lastSubmittedAttemptId: submitted.id,
        });

        window.setTimeout(() => {
          router.push(`/report?attemptId=${encodeURIComponent(submitted.id)}`);
        }, 500);
        return;
      }
    }

    // Fallback if no attempt existed
    update({ uploadedNames: fileNames });
    window.setTimeout(() => router.push("/report"), 500);
  };

  if (loading) {
    return (
      <main className="app-frame">
        <AppNav active="/upload" />
        <div className="app-content narrow-content" style={{ textAlign: "center", padding: "60px 0" }}>
          <h2>LOADING ATTEMPT DETAILS...</h2>
        </div>
      </main>
    );
  }

  return (
    <main className="app-frame">
      <AppNav active="/upload" />
      <div className="app-content narrow-content">
        <PageIntro
          eyebrow="STEP 02 · YOUR ANSWER SHEET"
          title="SHOW YOUR WORK."
          description={`Upload photos or a PDF of your written answers for ${paper ? paper.title : "your question paper"}. Arrange pages in order.`}
          action={
            <div className="upload-step">
              <span className="step-done">
                <Check size={13} />
              </span>
              <span>Paper complete</span>
              <i />
              <span className="step-current">02</span>
              <b>Upload pages</b>
              <i />
              <span>03</span>
              <span>Get feedback</span>
            </div>
          }
        />

        {paper && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(231,183,46,0.035)",
              border: "1px solid rgba(231,183,46,0.2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
              fontSize: "10px",
            }}
          >
            <span>
              <b style={{ color: "var(--gold)" }}>Submitting Answers For:</b> {paper.title}
            </span>
            <span style={{ color: "var(--muted)" }}>
              Max Marks: {paper.maximumMarks ?? 70} · Subject: {paper.subject ?? "Computer Science"}
            </span>
          </div>
        )}

        <div className="upload-instructions">
          <div className="upload-instruction-icon">
            <ImageIcon size={17} />
          </div>
          <div>
            <b>A CLEAR PHOTO MAKES FOR ACCURATE EVALUATION.</b>
            <p>
              Keep the page flat, well-lit, and in full frame. Do not write personal details—only clear handwritten answers and working steps.
            </p>
          </div>
        </div>

        {/* Drop zone */}
        <button
          className={`drop-zone ${dragging ? "is-dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <span className="drop-icon">
            <UploadCloud size={22} />
          </span>
          <b>
            Drop answer pages here or <u>browse files</u>
          </b>
          <span>Images (PNG, JPG) or PDF · Up to 20 pages · 20 MB per file</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </button>

        {error && <div className="upload-error">{error}</div>}

        {/* Uploaded Files Section */}
        <section className="uploaded-section">
          <div className="uploaded-heading">
            <div>
              <b>YOUR ANSWER PAGES</b>
              <span>
                {files.length} {files.length === 1 ? "file" : "files"}
                {files.length ? " · Drag/order into correct sequence" : " · Add your first page to get started"}
              </span>
            </div>
            {files.length > 0 && (
              <button className="inline-link" onClick={() => inputRef.current?.click()}>
                <Plus size={13} /> Add more pages
              </button>
            )}
          </div>

          {!files.length && !attempt?.answerFiles?.length && (
            <div className="upload-empty">
              <span>
                <FileText size={20} />
              </span>
              <b>No pages uploaded yet.</b>
              <p>They will appear here in sequence, ready to submit when you are.</p>
            </div>
          )}

          {!files.length && (attempt?.answerFiles.length ?? 0) > 0 && (
            <div className="uploaded-file-list">
              {attempt?.answerFiles.map((name, index) => (
                <div className="uploaded-file-row saved-file" key={`${name}-${index}`}>
                  <span className="page-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="file-type-icon">
                    {name.toLowerCase().endsWith(".pdf") ? <FileText size={17} /> : <ImageIcon size={17} />}
                  </span>
                  <span className="file-details">
                    <b>{name}</b>
                    <small>Recorded in saved attempt</small>
                  </span>
                  <span className="file-ready">
                    <Check size={12} /> Saved
                  </span>
                </div>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="uploaded-file-list">
              {files.map((item, index) => (
                <article className="uploaded-file-row" key={item.id}>
                  <span className="page-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="file-preview">
                    {item.url ? (
                      <img src={item.url} alt={`Preview ${item.file.name}`} />
                    ) : (
                      <span className="pdf-preview">
                        <FileText size={21} />
                        <small>PDF</small>
                      </span>
                    )}
                  </span>
                  <span className="file-details">
                    <b>{item.file.name}</b>
                    <small>
                      {item.file.type.startsWith("image/") ? "Answer page" : "Document"}{" "}
                      <i>·</i> {formatSize(item.file.size)}
                    </small>
                  </span>
                  <span className="file-ready">
                    <Check size={12} /> Ready
                  </span>
                  <div className="file-order-actions">
                    <button
                      aria-label={`Move ${item.file.name} up`}
                      disabled={index === 0}
                      onClick={() => moveFile(index, -1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      aria-label={`Move ${item.file.name} down`}
                      disabled={index === files.length - 1}
                      onClick={() => moveFile(index, 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => removeFile(item.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Thumbnail Preview Strip */}
        {imageFiles.length > 0 && (
          <section className="preview-strip">
            <div className="preview-strip-head">
              <b>PAGE PREVIEW STRIP</b>
              <span>
                {imageFiles.length} image{imageFiles.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="preview-grid">
              {files.map((item, index) =>
                item.url ? (
                  <div className="preview-tile" key={`preview-${item.id}`}>
                    <img src={item.url} alt={`Answer page ${index + 1}`} />
                    <span>PAGE {String(index + 1).padStart(2, "0")}</span>
                  </div>
                ) : null
              )}
            </div>
          </section>
        )}

        {/* Bottom submit bar */}
        <div className="upload-submit-bar">
          <Link
            href={attempt ? `/exam?paperId=${attempt.paperId}&attemptId=${attempt.id}` : "/test"}
            className="button button-outline"
          >
            <ArrowLeft size={14} /> Back to paper
          </Link>
          <div>
            <span aria-live="polite">
              {submitting
                ? "Recording submission in local data repository…"
                : files.length
                ? `${files.length} ${files.length === 1 ? "page" : "pages"} ready to evaluate`
                : "Add at least one answer page to submit"}
            </span>
            <button
              className="button button-gold"
              disabled={files.length === 0 || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <LoaderCircle className="loading-icon" size={14} /> Processing evaluation…
                </>
              ) : (
                <>
                  Submit for Evaluation <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="app-footnote">
          YOUR SUBMISSIONS ARE PERSISTENT <span>·</span> EVALUATION ENGINE READY
        </div>
      </div>
    </main>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <main className="app-frame">
          <AppNav active="/upload" />
          <div className="app-content narrow-content" style={{ textAlign: "center", padding: "60px 0" }}>
            <h2>LOADING ANSWER SHEET UPLOAD...</h2>
          </div>
        </main>
      }
    >
      <UploadContent />
    </Suspense>
  );
}

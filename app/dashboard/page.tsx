"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Clock3,
  FileCheck2,
  MoreHorizontal,
  Plus,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { AppNav, ButtonLink, StatCard } from "@/components/ui";
import { listPapers } from "@/lib/repositories/paperRepository";
import {
  getDashboardStatistics,
  listAttempts,
  listEvaluations,
  listTestPapers,
} from "@/lib/repositories/localRepository";
import { useAuth } from "@/components/auth-provider";
import type { DashboardStatistics, PaperManifest, StudentAttempt, EvaluationRecord } from "@/lib/models";

const zeroStats: DashboardStatistics = {
  attempts: 0,
  averageScorePercent: 0,
  pendingEvaluations: 0,
  personalBestPercent: 0,
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function DashboardPage() {
  const { user, isExaminer } = useAuth();
  const [stats, setStats] = useState(zeroStats);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [manifest, setManifest] = useState<PaperManifest | null>(null);
  const [loadError, setLoadError] = useState("");
  const [serverPendingCount, setServerPendingCount] = useState(0);

  useEffect(() => {
    setStats(getDashboardStatistics());
    setAttempts(listAttempts());
    setEvaluations(listEvaluations());

    listPapers()
      .then(setManifest)
      .catch(() => setLoadError("Paper catalogue is not available. Rebuild the local paper index."));

    // Check server review queue metrics
    fetch("/api/review")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.success) {
          if (data.metrics) {
            setServerPendingCount(data.metrics.pendingReview || 0);
          }
          if (Array.isArray(data.evaluations) && data.evaluations.length > 0) {
            setEvaluations((prev) => {
              const ids = new Set(prev.map((e) => e.id));
              const additions = data.evaluations.filter((e: any) => !ids.has(e.id));
              return [...prev, ...additions];
            });
          }
        }
      })
      .catch(() => {});
  }, []);

  const testCount = manifest ? listTestPapers(manifest.papers).length : 0;
  const resourcePapers = manifest?.papers.slice(0, 3) ?? [];

  // Map of attemptId -> Evaluation
  const evalMap = new Map<string, EvaluationRecord>();
  evaluations.forEach((e) => {
    evalMap.set(e.attemptId, e);
    evalMap.set(e.id, e);
  });

  const greetingName = user?.name ? user.name.split(" ")[0] : "Student";

  return (
    <main className="app-frame">
      <AppNav active="/dashboard" />
      <div className="app-content">
        {/* Examiner Quick Supervision Banner */}
        {isExaminer && (
          <div
            style={{
              marginBottom: "20px",
              padding: "14px 20px",
              background: "rgba(231,183,46,0.08)",
              border: "1px solid rgba(231,183,46,0.35)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "var(--gold)",
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                ⚖
              </div>
              <div>
                <b style={{ color: "#fff", fontSize: "13px" }}>
                  Head Examiner Workspace &bull; Nitin Paliwal
                </b>
                <div style={{ color: "var(--muted)", fontSize: "11px", fontFamily: "monospace" }}>
                  {serverPendingCount > 0
                    ? `${serverPendingCount} candidate submissions awaiting verification in the review queue.`
                    : "Review queue is up to date. All evaluations published."}
                </div>
              </div>
            </div>

            <Link
              href="/review"
              className="button button-gold button-small"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px" }}
            >
              <span>Open Review Queue</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        )}

        {/* Dashboard Welcome Header */}
        <div className="dashboard-welcome">
          <div>
            <div className="eyebrow">
              <span /> CBSE CLASS 12 &bull; COMPUTER SCIENCE (083)
            </div>
            <h1>
              WELCOME, {greetingName.toUpperCase()}
              <span>.</span>
            </h1>
            <p>Your examination practice, authentic question papers, and verified evaluation reports.</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <ButtonLink href="/test">
              Browse papers <ArrowRight size={15} />
            </ButtonLink>
          </div>
        </div>

        {/* Top 4 KPI Stat Cards */}
        <div className="stats-grid">
          <StatCard
            label="PAPERS ATTEMPTED"
            value={stats.attempts}
            note={stats.attempts ? "From saved exam submissions" : "No submitted attempts yet"}
            icon={<FileCheck2 size={17} />}
          />
          <StatCard
            label="VERIFIED AVERAGE"
            value={
              stats.attempts > 0 && stats.pendingEvaluations === stats.attempts
                ? "Pending"
                : `${stats.averageScorePercent}%`
            }
            note={
              stats.attempts > 0 && stats.pendingEvaluations === stats.attempts
                ? "Awaiting examiner verification"
                : stats.averageScorePercent
                ? "From approved evaluations"
                : "No verified evaluations yet"
            }
            icon={<TrendingUp size={17} />}
          />
          <StatCard
            label="PENDING VERIFICATION"
            value={stats.pendingEvaluations}
            note={
              stats.pendingEvaluations === 1
                ? "1 submission in examiner review"
                : stats.pendingEvaluations > 1
                ? `${stats.pendingEvaluations} submissions in review`
                : "All evaluations released"
            }
            icon={<Clock3 size={17} />}
          />
          <StatCard
            label="PERSONAL BEST"
            value={stats.personalBestPercent ? `${stats.personalBestPercent}%` : "—"}
            note={stats.personalBestPercent ? "Highest approved score" : "No score recorded yet"}
            icon={<Award size={17} />}
          />
        </div>

        {/* 2-Column Content Grid */}
        <div className="dashboard-columns">
          {/* Papers Panel */}
          <section className="dashboard-panel papers-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">
                  <span /> CBSE CLASS 12 QUESTION PAPERS
                </div>
                <h2>{manifest?.papers.length ?? 0} PAPERS INDEXED.</h2>
              </div>
              <Link href="/test" className="inline-link">
                Catalogue <ArrowUpRight size={14} />
              </Link>
            </div>

            {loadError && <p className="empty-note">{loadError}</p>}
            {!loadError && manifest && resourcePapers.length === 0 && (
              <div className="resource-empty">
                <BookOpen size={20} />
                <b>No study materials indexed yet.</b>
                <span>Run the paper indexing command to scan your source folder.</span>
              </div>
            )}

            <div className="paper-list">
              {resourcePapers.map((paper, index) => (
                <article className="paper-list-item" key={paper.id}>
                  <div className={`subject-icon subject-${index}`}>
                    {paper.kind === "question_paper" ? "QP" : paper.format.toUpperCase()}
                  </div>
                  <div className="paper-list-main">
                    <span>
                      {paper.paperType ?? "Computer Science material"}
                      <i> &bull; {paper.format.toUpperCase()}</i>
                    </span>
                    <strong>{paper.title}</strong>
                    <small>
                      {paper.year ?? "Year unknown"} <span>&bull;</span>{" "}
                      {paper.maximumMarks === null ? "70 marks" : `${paper.maximumMarks} marks`}{" "}
                      <span>&bull;</span>{" "}
                      {paper.durationMinutes === null ? "180 min" : `${paper.durationMinutes} min`}
                    </small>
                  </div>
                  <Link
                    href={`/test?paper=${encodeURIComponent(paper.id)}`}
                    className="list-arrow"
                    aria-label={`View ${paper.title}`}
                  >
                    <ArrowRight size={15} />
                  </Link>
                </article>
              ))}
            </div>

            {manifest && resourcePapers.length > 0 && (
              <Link href="/test" className="paper-browse">
                <Plus size={14} /> Browse all {manifest.papers.length} indexed files
              </Link>
            )}
          </section>

          {/* Evaluation Progress Panel */}
          <section className="dashboard-panel progress-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">
                  <span /> EVALUATION PROGRESS
                </div>
                <h2>
                  {stats.averageScorePercent
                    ? "RECORDED SCORES."
                    : stats.pendingEvaluations > 0
                    ? "EXAMINER QUEUE."
                    : "READY TO BEGIN."}
                </h2>
              </div>
              <Link href="/report" className="icon-button" aria-label="View evaluations">
                <MoreHorizontal size={17} />
              </Link>
            </div>

            <div className="progress-ring-wrap">
              <div
                className="progress-ring"
                style={{
                  background: stats.averageScorePercent
                    ? `conic-gradient(var(--gold) 0deg ${Math.round(
                        (stats.averageScorePercent / 100) * 360
                      )}deg, #292720 ${Math.round((stats.averageScorePercent / 100) * 360)}deg 360deg)`
                    : stats.pendingEvaluations > 0
                    ? `conic-gradient(rgba(231,183,46,0.3) 0deg 360deg)`
                    : `conic-gradient(#292720 0deg 360deg)`,
                }}
              >
                <div>
                  <strong>
                    {stats.averageScorePercent
                      ? `${stats.averageScorePercent}%`
                      : stats.pendingEvaluations > 0
                      ? "REVIEW"
                      : "0%"}
                  </strong>
                  <span>
                    {stats.pendingEvaluations > 0 && !stats.averageScorePercent
                      ? "IN QUEUE"
                      : "AVERAGE"}
                  </span>
                </div>
              </div>
            </div>

            <div className="progress-details">
              <span>
                <i className="status-dot dot-green" /> Approved Reports
              </span>
              <strong>{stats.attempts - stats.pendingEvaluations}</strong>
              <span>
                <i className="status-dot dot-yellow" /> Pending Verification
              </span>
              <strong>{stats.pendingEvaluations}</strong>
            </div>

            <div className="focus-note">
              <span className="focus-icon">
                <BookOpen size={15} />
              </span>
              <p>
                <b>Authentic CBSE Exam Mode</b>
                <br />
                {testCount
                  ? `${testCount} question paper${testCount === 1 ? "" : "s"} ready for exam practice.`
                  : "No question papers found in the current index."}
              </p>
              <ArrowRight size={14} />
            </div>
          </section>
        </div>

        {/* History Panel */}
        <section className="dashboard-panel history-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">
                <span /> YOUR SAVED ATTEMPTS &bull; AUDIT TRAIL
              </div>
              <h2>RECENT ATTEMPTS</h2>
            </div>
            <Link href="/report" className="inline-link">
              Evaluations <ArrowUpRight size={14} />
            </Link>
          </div>

          {attempts.length === 0 ? (
            <div className="resource-empty history-empty">
              <FileCheck2 size={20} />
              <b>No attempts yet.</b>
              <span>Start a test from an indexed question paper to record your work.</span>
            </div>
          ) : (
            <div className="history-table">
              <div className="history-head">
                <span>PAPER</span>
                <span>SUBMITTED</span>
                <span>VERIFIED RESULT</span>
                <span>STATUS</span>
                <span />
              </div>
              {attempts.slice(0, 8).map((attempt) => {
                const paper = manifest?.papers.find((item) => item.id === attempt.paperId);
                const evaluation = evalMap.get(attempt.id);
                const isApproved =
                  evaluation && (evaluation.approvalStatus === "approved" || evaluation.status === "approved");
                const isUnderReview =
                  evaluation && evaluation.approvalStatus !== "approved" && evaluation.score !== null;

                return (
                  <Link
                    href={`/report?attemptId=${encodeURIComponent(attempt.id)}`}
                    key={attempt.id}
                    className="history-row"
                  >
                    <span className="history-paper">
                      <b>{paper?.title ?? "CBSE Class 12 Computer Science (083)"}</b>
                      <small>Set 4 &bull; QP Code 91 &bull; 70 Marks</small>
                    </span>
                    <span>{formatDate(attempt.startedAt)}</span>
                    <strong>
                      {isApproved && evaluation?.score !== null
                        ? `${evaluation.score}/70 (${evaluation.percentage}%)`
                        : isUnderReview
                        ? "Under Review"
                        : "Pending"}
                    </strong>
                    <span
                      className={`table-status ${
                        isApproved
                          ? "good"
                          : isUnderReview
                          ? "pending"
                          : attempt.status === "submitted" || attempt.status === "awaiting_evaluation"
                          ? "pending"
                          : ""
                      }`}
                    >
                      <i />
                      {isApproved
                        ? "Verified & Approved"
                        : isUnderReview
                        ? "Examiner Review"
                        : attempt.status === "submitted" || attempt.status === "awaiting_evaluation"
                        ? "Awaiting Evaluation"
                        : "In Progress"}
                    </span>
                    <ArrowRight size={14} />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {manifest?.unreadableFiles.length ? (
          <div className="index-warning">
            {manifest.unreadableFiles.length} file(s) could not be indexed. See the manifest for file paths and errors.
          </div>
        ) : null}

        <div className="app-footnote">
          CBSE CLASS 12 &bull; COMPUTER SCIENCE (083) <span>&bull;</span> HEAD EVALUATOR NITIN PALIWAL
        </div>
      </div>
    </main>
  );
}

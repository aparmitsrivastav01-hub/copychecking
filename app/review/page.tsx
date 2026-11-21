"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import type { EvaluationRecord } from "@/lib/models";

export default function ExaminerQueuePage() {
  const router = useRouter();
  const { user, isExaminer, isLoading, switchUser } = useAuth();

  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [metrics, setMetrics] = useState({
    totalSubmissions: 0,
    pendingReview: 0,
    approvedPublished: 0,
    flaggedForAttention: 0,
    averageScore: 0,
  });
  const [loadingData, setLoadingData] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function fetchQueue() {
      try {
        setLoadingData(true);
        const res = await fetch(`/api/review?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setEvaluations(data.evaluations || []);
            setMetrics(data.metrics || metrics);
          }
        }
      } catch (err) {
        console.error("Failed to load review queue:", err);
      } finally {
        setLoadingData(false);
      }
    }

    if (!isLoading && isExaminer) {
      fetchQueue();
    }
  }, [isLoading, isExaminer, statusFilter, searchQuery]);

  // Filtered list
  const filteredList = useMemo(() => {
    return evaluations.filter((e) => {
      if (statusFilter === "pending") {
        return e.approvalStatus === "pending_review" || e.approvalStatus === "draft";
      }
      if (statusFilter === "flagged") {
        return (
          (e.reviewAlerts && e.reviewAlerts.length > 0) ||
          e.questions.some((q) => q.needsHumanReview || q.flaggedForManualReview)
        );
      }
      if (statusFilter === "approved") {
        return e.approvalStatus === "approved";
      }
      return true;
    });
  }, [evaluations, statusFilter]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a09] flex items-center justify-center text-[#e7b72e]">
        <div className="flex items-center gap-3 font-mono text-sm">
          <div className="w-5 h-5 border-2 border-[#e7b72e] border-t-transparent rounded-full animate-spin"></div>
          Authenticating Examiner Session...
        </div>
      </div>
    );
  }

  // If not logged in as examiner, show access prompt with 1-click login as Nitin Paliwal
  if (!isExaminer) {
    return (
      <div className="min-h-screen bg-[#0a0a09] text-[#e8e6df] flex flex-col justify-between">
        <header className="border-b border-[#26241e] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#e7b72e] text-black font-bold flex items-center justify-center">
              PC
            </div>
            <span className="font-semibold text-white">PaperCheck AI &bull; Head Evaluator Portal</span>
          </div>
          <Link href="/dashboard" className="text-xs text-[#a09b8f] hover:text-[#e7b72e] font-mono">
            &larr; Student Dashboard
          </Link>
        </header>

        <main className="max-w-lg mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1c1a14] border border-[#e7b72e]/30 text-[#e7b72e] flex items-center justify-center mx-auto mb-6 text-2xl shadow-[0_0_25px_rgba(231,183,46,0.2)]">
            ⚖
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Examiner Verification Portal</h1>
          <p className="text-sm text-[#a09b8f] mb-8 leading-relaxed">
            This dashboard is reserved for <strong>Nitin Paliwal</strong> (Head Examiner) and authorized CBSE evaluators to review, adjust, and approve AI evaluations before release.
          </p>

          <div className="space-y-3">
            <button
              onClick={async () => {
                await switchUser("examiner");
                router.refresh();
              }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#e7b72e] to-[#c79818] text-black font-semibold text-sm hover:brightness-110 transition shadow-[0_0_20px_rgba(231,183,46,0.25)] flex items-center justify-center gap-2"
            >
              <span>Sign in as Nitin Paliwal (Head Examiner)</span>
              <span>&rarr;</span>
            </button>
            <Link
              href="/login"
              className="block w-full py-2.5 px-4 rounded-xl border border-[#343026] text-xs font-mono text-[#a09b8f] hover:text-white hover:bg-[#151411] transition"
            >
              Sign in with Different Account
            </Link>
          </div>
        </main>

        <footer className="border-t border-[#26241e] px-6 py-4 text-center text-xs text-[#6e6a5e] font-mono">
          CBSE Assessment Protocol &bull; Confidential Examiner Controls
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a09] text-[#e8e6df] selection:bg-[#e7b72e]/30 selection:text-[#e7b72e]">
      {/* Top Header */}
      <header className="border-b border-[#26241e] bg-[#0e0e0d] sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e7b72e] to-[#c79818] text-black font-bold flex items-center justify-center text-sm shadow-[0_0_15px_rgba(231,183,46,0.3)]">
              PC
            </div>
            <span className="font-semibold text-white tracking-wide">PaperCheck AI</span>
          </Link>
          <div className="h-4 w-px bg-[#26241e]"></div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-wider text-[#e7b72e] bg-[#221c0e] px-2.5 py-1 rounded-md border border-[#e7b72e]/30">
              EXAMINER WORKSPACE
            </span>
            <span className="text-xs text-[#a09b8f] font-mono hidden md:inline">
              CBSE Class 12 CS (083)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-xs font-mono text-[#a09b8f] hover:text-[#e7b72e] transition hidden sm:inline"
          >
            &larr; Student View
          </Link>

          <div className="flex items-center gap-2.5 pl-3 border-l border-[#26241e]">
            <div className="w-7 h-7 rounded-full bg-[#1e1c15] border border-[#e7b72e]/40 flex items-center justify-center text-xs font-bold text-[#e7b72e]">
              NP
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-white leading-none">Nitin Paliwal</div>
              <div className="text-[10px] text-[#a09b8f] font-mono leading-tight">Head Examiner</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome & Queue Status Banner */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f1e1a] pb-6">
          <div>
            <div className="text-xs font-mono text-[#e7b72e] mb-1">
              CENTRAL BOARD OF SECONDARY EDUCATION &bull; EVALUATION PORTAL
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Answer Sheet Verification Queue
            </h1>
            <p className="text-xs text-[#a09b8f] mt-1">
              Verify AI-assisted mark suggestions against the official QP Code 91 marking scheme before publishing results to students.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141411] border border-[#26241e] text-xs font-mono text-[#e7b72e]">
              <span className="w-2 h-2 rounded-full bg-[#e7b72e] animate-ping"></span>
              Live Sync Active
            </span>
          </div>
        </div>

        {/* Metrics KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-8">
          <div className="bg-[#121210] border border-[#26241e] rounded-xl p-4">
            <div className="text-[11px] font-mono text-[#a09b8f] uppercase">Total Submissions</div>
            <div className="text-2xl font-bold text-white mt-1.5">{metrics.totalSubmissions}</div>
            <div className="text-[11px] text-[#716e64] mt-1 font-mono">Assigned to batch</div>
          </div>

          <div className="bg-[#17140b] border border-[#e7b72e]/30 rounded-xl p-4 shadow-[0_0_15px_rgba(231,183,46,0.06)]">
            <div className="text-[11px] font-mono text-[#e7b72e] uppercase flex items-center justify-between">
              <span>Pending Review</span>
              <span className="w-2 h-2 rounded-full bg-[#e7b72e] animate-pulse"></span>
            </div>
            <div className="text-2xl font-bold text-[#e7b72e] mt-1.5">{metrics.pendingReview}</div>
            <div className="text-[11px] text-[#a09b8f] mt-1 font-mono">Awaiting verification</div>
          </div>

          <div className="bg-[#0e1610] border border-green-500/25 rounded-xl p-4">
            <div className="text-[11px] font-mono text-green-400 uppercase">Approved &amp; Published</div>
            <div className="text-2xl font-bold text-green-400 mt-1.5">{metrics.approvedPublished}</div>
            <div className="text-[11px] text-[#716e64] mt-1 font-mono">Visible to students</div>
          </div>

          <div className="bg-[#181111] border border-red-500/25 rounded-xl p-4">
            <div className="text-[11px] font-mono text-red-400 uppercase">Flagged For Review</div>
            <div className="text-2xl font-bold text-red-400 mt-1.5">{metrics.flaggedForAttention}</div>
            <div className="text-[11px] text-[#716e64] mt-1 font-mono">Ambiguities / Low OCR</div>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-[#121210] border border-[#26241e] rounded-xl p-4">
            <div className="text-[11px] font-mono text-[#a09b8f] uppercase">Batch Average Score</div>
            <div className="text-2xl font-bold text-white mt-1.5">{metrics.averageScore} <span className="text-xs font-normal text-[#a09b8f]">/ 70</span></div>
            <div className="text-[11px] text-[#716e64] mt-1 font-mono">
              {metrics.averageScore ? Math.round((metrics.averageScore / 70) * 100) : 0}% mean score
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#141411] border border-[#26241e] rounded-xl w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                statusFilter === "all"
                  ? "bg-[#26241e] text-white font-semibold"
                  : "text-[#a09b8f] hover:text-white"
              }`}
            >
              All ({evaluations.length})
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                statusFilter === "pending"
                  ? "bg-[#e7b72e]/20 text-[#e7b72e] border border-[#e7b72e]/30 font-semibold"
                  : "text-[#a09b8f] hover:text-[#e7b72e]"
              }`}
            >
              <span>Pending Review</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#e7b72e]/30 text-[#e7b72e]">
                {metrics.pendingReview}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter("flagged")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                statusFilter === "flagged"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30 font-semibold"
                  : "text-[#a09b8f] hover:text-red-400"
              }`}
            >
              <span>Flagged</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500/30 text-red-400">
                {metrics.flaggedForAttention}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter("approved")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                statusFilter === "approved"
                  ? "bg-green-500/20 text-green-400 border border-green-500/30 font-semibold"
                  : "text-[#a09b8f] hover:text-green-400"
              }`}
            >
              Approved ({metrics.approvedPublished})
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search student, roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121210] border border-[#26241e] rounded-xl px-3.5 py-2 pl-9 text-xs text-white placeholder-[#6e6a5e] focus:outline-none focus:border-[#e7b72e] transition"
            />
            <svg
              className="w-3.5 h-3.5 text-[#6e6a5e] absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 1114 0z" />
            </svg>
          </div>
        </div>

        {/* Evaluation Submissions Queue Table */}
        <div className="bg-[#121210] border border-[#26241e] rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#26241e] bg-[#161512] text-[11px] font-mono text-[#a09b8f] uppercase">
                  <th className="py-3 px-4">Candidate &amp; Roll No</th>
                  <th className="py-3 px-4">Examination Paper</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-center">AI Suggested</th>
                  <th className="py-3 px-4 text-center">Examiner Status</th>
                  <th className="py-3 px-4 text-center">Audit / Flags</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1d18] text-xs">
                {loadingData ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#a09b8f] font-mono">
                      <div className="w-5 h-5 border-2 border-[#e7b72e] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Loading verification queue...
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#716e64] font-mono">
                      No submissions match the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((evalRecord) => {
                    const isApproved = evalRecord.approvalStatus === "approved";
                    const isDraft = evalRecord.approvalStatus === "draft";
                    const isPending = !isApproved && !isDraft;
                    const flaggedCount =
                      (evalRecord.reviewAlerts?.length || 0) +
                      evalRecord.questions.filter((q) => q.needsHumanReview || q.flaggedForManualReview).length;

                    return (
                      <tr
                        key={evalRecord.id}
                        className="hover:bg-[#171612] transition group"
                      >
                        {/* Candidate */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{evalRecord.studentName || "Candidate"}</span>
                            {isApproved && (
                              <span className="text-[10px] text-green-400 font-mono" title="Published to Student">
                                ✓
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#a09b8f] font-mono">
                            Roll: {evalRecord.studentRollNo || "12498231"}
                          </div>
                        </td>

                        {/* Paper */}
                        <td className="py-3.5 px-4">
                          <div className="text-white font-medium">Class 12 CS (083) - Set 4</div>
                          <div className="text-[11px] text-[#716e64] font-mono">QP Code: 91 &bull; 70 Marks</div>
                        </td>

                        {/* Submitted Time */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#a09b8f]">
                          {new Date(evalRecord.submittedAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        {/* AI Score */}
                        <td className="py-3.5 px-4 text-center font-mono">
                          <div className="text-sm font-bold text-white">
                            {evalRecord.score ?? "--"}{" "}
                            <span className="text-[10px] text-[#716e64] font-normal">/ {evalRecord.maximumMarks}</span>
                          </div>
                          <div className="text-[10px] text-[#a09b8f]">
                            {evalRecord.percentage !== null ? `${evalRecord.percentage}%` : "--"}
                          </div>
                        </td>

                        {/* Approval Status Badge */}
                        <td className="py-3.5 px-4 text-center">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-green-500/15 text-green-400 border border-green-500/30">
                              <span>✓</span> APPROVED
                            </span>
                          ) : isDraft ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              <span>✎</span> DRAFT REVIEW
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#e7b72e]/15 text-[#e7b72e] border border-[#e7b72e]/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#e7b72e] animate-pulse"></span> PENDING REVIEW
                            </span>
                          )}
                        </td>

                        {/* Audit / Flags */}
                        <td className="py-3.5 px-4 text-center">
                          {flaggedCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-mono">
                              ⚠ {flaggedCount} Flag{flaggedCount > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-[#716e64]">
                              Clean match
                            </span>
                          )}
                        </td>

                        {/* Action CTA */}
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/review/${evalRecord.id}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                              isApproved
                                ? "bg-[#1f1e1a] hover:bg-[#26241e] text-[#e8e6df]"
                                : "bg-[#e7b72e] hover:brightness-110 text-black shadow-[0_0_12px_rgba(231,183,46,0.2)]"
                            }`}
                          >
                            <span>{isApproved ? "Inspect Record" : "Review & Verify"}</span>
                            <span>&rarr;</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#26241e] px-4 py-3 bg-[#161512] flex items-center justify-between text-xs text-[#716e64] font-mono">
            <div>
              Showing {filteredList.length} of {evaluations.length} total student submissions
            </div>
            <div className="flex items-center gap-2">
              <span>Examiner: Nitin Paliwal</span>
              <span>&bull;</span>
              <span>Evaluation Standard: CBSE Class 12 CS (083) QP 91</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

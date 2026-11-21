"use client";

import { useEffect, useState, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import type { EvaluationRecord, QuestionEvaluationItem } from "@/lib/models";

export default function ReviewWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const { user, isExaminer, isLoading } = useAuth();

  const [evaluation, setEvaluation] = useState<EvaluationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Left panel states
  const [activePage, setActivePage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewMode, setViewMode] = useState<"document" | "transcription">("document");

  // Right panel states
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("q1");
  const [searchQuestion, setSearchQuestion] = useState<string>("");

  // Question editing buffer: questionId -> { marks, feedback, reason, flagged }
  const [editedQuestions, setEditedQuestions] = useState<
    Record<
      string,
      {
        marks: number;
        feedback: string;
        reason: string;
        flagged: boolean;
        isEdited: boolean;
      }
    >
  >({});

  // Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [examinerGeneralNotes, setExaminerGeneralNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch evaluation detail
  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true);
        const res = await fetch(`/api/review/${id}`);
        const data = await res.json();
        if (res.ok && data.success && data.evaluation) {
          const rec: EvaluationRecord = data.evaluation;
          setEvaluation(rec);
          setExaminerGeneralNotes(rec.examinerNotes || "");

          // Initialize edit buffer
          const buffer: Record<string, any> = {};
          rec.questions.forEach((q) => {
            const currentMarks =
              q.examinerMarks !== null && q.examinerMarks !== undefined
                ? q.examinerMarks
                : (q.awardedMarks ?? 0);
            buffer[q.questionId] = {
              marks: currentMarks,
              feedback: q.examinerFeedback || q.evaluatorFeedback || "",
              reason: q.examinerOverrideReason || "Examiner verified against official CBSE key",
              flagged: !!q.flaggedForManualReview || !!q.needsHumanReview,
              isEdited: q.examinerApproved || false,
            };
          });
          setEditedQuestions(buffer);
        } else {
          setError(data.error || "Failed to load evaluation.");
        }
      } catch (err: any) {
        setError(err?.message || "Network error loading evaluation.");
      } finally {
        setLoading(false);
      }
    }

    if (!isLoading && isExaminer) {
      loadDetail();
    }
  }, [id, isLoading, isExaminer]);

  // Live Recalculated Total Score
  const liveScore = useMemo(() => {
    if (!evaluation) return 0;
    return evaluation.questions.reduce((sum, q) => {
      const edit = editedQuestions[q.questionId];
      const marks = edit ? edit.marks : (q.awardedMarks ?? 0);
      return sum + marks;
    }, 0);
  }, [evaluation, editedQuestions]);

  const livePercentage = useMemo(() => {
    if (!evaluation || evaluation.maximumMarks <= 0) return 0;
    return Math.round((liveScore / evaluation.maximumMarks) * 100);
  }, [liveScore, evaluation]);

  const originalAiScore = useMemo(() => {
    if (!evaluation) return 0;
    return evaluation.questions.reduce((sum, q) => sum + (q.awardedMarks ?? 0), 0);
  }, [evaluation]);

  const scoreDelta = liveScore - originalAiScore;

  // Filtered Questions by section & search
  const visibleQuestions = useMemo(() => {
    if (!evaluation) return [];
    return evaluation.questions.filter((q) => {
      const matchSection =
        selectedSection === "ALL" ||
        q.section.replace(/\s+/g, "").toUpperCase() === selectedSection.toUpperCase() ||
        q.section.endsWith(selectedSection);
      const matchSearch =
        !searchQuestion ||
        q.number.toString().includes(searchQuestion) ||
        q.title.toLowerCase().includes(searchQuestion.toLowerCase()) ||
        q.topic.toLowerCase().includes(searchQuestion.toLowerCase());
      return matchSection && matchSearch;
    });
  }, [evaluation, selectedSection, searchQuestion]);

  // Handle Mark Step change
  function handleMarkStep(questionId: string, maxMarks: number, delta: number) {
    setEditedQuestions((prev) => {
      const current = prev[questionId]?.marks ?? 0;
      const next = Math.max(0, Math.min(maxMarks, Number((current + delta).toFixed(1))));
      return {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          marks: next,
          isEdited: true,
        },
      };
    });
  }

  function handleMarkDirectChange(questionId: string, maxMarks: number, val: string) {
    const num = parseFloat(val);
    const safeNum = isNaN(num) ? 0 : Math.max(0, Math.min(maxMarks, num));
    setEditedQuestions((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        marks: safeNum,
        isEdited: true,
      },
    }));
  }

  function handleFeedbackChange(questionId: string, text: string) {
    setEditedQuestions((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        feedback: text,
        isEdited: true,
      },
    }));
  }

  function handleReasonChange(questionId: string, reason: string) {
    setEditedQuestions((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        reason,
        isEdited: true,
      },
    }));
  }

  function handleFlagToggle(questionId: string) {
    setEditedQuestions((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        flagged: !prev[questionId]?.flagged,
        isEdited: true,
      },
    }));
  }

  // Save single question override to backend
  async function persistQuestionChange(questionId: string) {
    if (!editedQuestions[questionId]) return;
    const { marks, feedback, reason, flagged } = editedQuestions[questionId];

    try {
      setIsSaving(true);
      const res = await fetch(`/api/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "modify_question",
          questionId,
          marks,
          feedback,
          reason,
          flagged,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEvaluation(data.evaluation);
        triggerToast(`Verified Q${questionId.replace("q", "")} (${marks} marks)`);
      } else {
        alert(data.error || "Failed to save modification");
      }
    } catch (e: any) {
      alert(e?.message || "Network error");
    } finally {
      setIsSaving(false);
    }
  }

  // Save Draft
  async function handleSaveDraft() {
    try {
      setIsSaving(true);
      const res = await fetch(`/api/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          examinerNotes: examinerGeneralNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEvaluation(data.evaluation);
        triggerToast("Draft evaluation progress saved successfully.");
      }
    } catch (e: any) {
      alert("Error saving draft: " + e?.message);
    } finally {
      setIsSaving(false);
    }
  }

  // Approve & Publish Final Score
  async function handleApproveAndPublish() {
    try {
      setIsSaving(true);
      // Persist any un-saved question modifications first
      for (const q of evaluation?.questions || []) {
        const edit = editedQuestions[q.questionId];
        if (edit && edit.isEdited) {
          await fetch(`/api/review/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "modify_question",
              questionId: q.questionId,
              marks: edit.marks,
              feedback: edit.feedback,
              reason: edit.reason,
              flagged: edit.flagged,
            }),
          });
        }
      }

      // Now approve
      const res = await fetch(`/api/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          examinerNotes: examinerGeneralNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEvaluation(data.evaluation);
        setShowApproveModal(false);
        triggerToast("Approved & Published! Student report unlocked.");
        setTimeout(() => {
          router.push("/review");
        }, 1500);
      } else {
        alert(data.error || "Approval failed");
      }
    } catch (e: any) {
      alert("Error approving: " + e?.message);
    } finally {
      setIsSaving(false);
    }
  }

  // Reject / Request Re-evaluation
  async function handleReject() {
    if (!rejectReason.trim()) {
      alert("Please provide a reason for returning the submission.");
      return;
    }
    try {
      setIsSaving(true);
      const res = await fetch(`/api/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          reason: rejectReason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEvaluation(data.evaluation);
        setShowRejectModal(false);
        triggerToast("Submission returned for re-evaluation.");
        setTimeout(() => {
          router.push("/review");
        }, 1500);
      }
    } catch (e: any) {
      alert("Error rejecting: " + e?.message);
    } finally {
      setIsSaving(false);
    }
  }

  function triggerToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  // Quick jump helper: jumps question and switches to page
  function jumpToQuestion(q: QuestionEvaluationItem) {
    setSelectedQuestionId(q.questionId);
    if (q.extractedFromPages && q.extractedFromPages.length > 0) {
      setActivePage(q.extractedFromPages[0]);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a09] flex items-center justify-center text-[#e7b72e]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#e7b72e] border-t-transparent rounded-full animate-spin"></div>
          <span className="font-mono text-xs">Loading Review Workspace for {id}...</span>
        </div>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-screen bg-[#0a0a09] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="text-red-400 text-3xl mb-3">⚠</div>
        <h2 className="text-xl font-bold mb-2">Failed to Load Submission</h2>
        <p className="text-sm text-[#a09b8f] mb-6">{error || "Record not found."}</p>
        <Link
          href="/review"
          className="px-4 py-2 bg-[#26241e] hover:bg-[#343026] text-white text-xs font-mono rounded-lg transition"
        >
          &larr; Return to Review Queue
        </Link>
      </div>
    );
  }

  const isApproved = evaluation.approvalStatus === "approved";

  return (
    <div className="h-screen bg-[#0a0a09] text-[#e8e6df] flex flex-col overflow-hidden selection:bg-[#e7b72e]/30 selection:text-[#e7b72e]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#1e1c14] border border-[#e7b72e] text-[#e7b72e] text-xs font-mono shadow-[0_0_20px_rgba(231,183,46,0.3)] flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Workspace Header */}
      <header className="h-14 border-b border-[#26241e] bg-[#0d0d0c] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/review"
            className="p-1.5 rounded-lg bg-[#161512] hover:bg-[#22201b] border border-[#2b2923] text-xs text-[#a09b8f] hover:text-white transition font-mono flex items-center gap-1"
          >
            &larr; Queue
          </Link>
          <div className="h-4 w-px bg-[#26241e]"></div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">
                {evaluation.studentName || "Candidate"}
              </span>
              <span className="text-[11px] font-mono text-[#a09b8f] bg-[#1a1915] px-2 py-0.5 rounded border border-[#2b2923]">
                Roll: {evaluation.studentRollNo || "12498231"}
              </span>
              {isApproved ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                  APPROVED &amp; RELEASED
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#e7b72e]/15 text-[#e7b72e] border border-[#e7b72e]/30">
                  EXAMINER VERIFICATION MODE
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Examination Details */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-[#a09b8f]">
          <span>CBSE Class 12 CS (083)</span>
          <span>&bull;</span>
          <span>Set 4 QP Code 91</span>
          <span>&bull;</span>
          <span>Max Marks: {evaluation.maximumMarks}</span>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAuditModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-[#141411] hover:bg-[#1c1b16] border border-[#26241e] text-xs font-mono text-[#a09b8f] hover:text-[#e7b72e] transition flex items-center gap-1.5"
          >
            <span>📜</span>
            <span className="hidden sm:inline">Audit Trail ({evaluation.auditLog?.length || 0})</span>
          </button>
        </div>
      </header>

      {/* Main Split-Screen Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================= LEFT PANEL: Document Viewer ================= */}
        <div className="w-1/2 border-r border-[#26241e] flex flex-col bg-[#0b0b0a] overflow-hidden">
          {/* Viewer Toolbar */}
          <div className="h-11 border-b border-[#26241e] bg-[#121210] px-4 flex items-center justify-between shrink-0">
            {/* View switcher */}
            <div className="flex items-center gap-1 bg-[#171612] p-0.5 rounded-lg border border-[#26241e]">
              <button
                onClick={() => setViewMode("document")}
                className={`px-2.5 py-1 text-[11px] font-mono rounded ${
                  viewMode === "document"
                    ? "bg-[#26241e] text-[#e7b72e] font-semibold"
                    : "text-[#a09b8f] hover:text-white"
                }`}
              >
                Scanned Sheet
              </button>
              <button
                onClick={() => setViewMode("transcription")}
                className={`px-2.5 py-1 text-[11px] font-mono rounded ${
                  viewMode === "transcription"
                    ? "bg-[#26241e] text-[#e7b72e] font-semibold"
                    : "text-[#a09b8f] hover:text-white"
                }`}
              >
                Extracted OCR
              </button>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-2 text-xs font-mono text-[#a09b8f]">
              <button
                onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                disabled={activePage <= 1}
                className="w-6 h-6 rounded bg-[#1c1b16] hover:bg-[#26241e] disabled:opacity-30 flex items-center justify-center text-white"
              >
                &lsaquo;
              </button>
              <span>
                Page <span className="text-[#e7b72e] font-bold">{activePage}</span> of 7
              </span>
              <button
                onClick={() => setActivePage((p) => Math.min(7, p + 1))}
                disabled={activePage >= 7}
                className="w-6 h-6 rounded bg-[#1c1b16] hover:bg-[#26241e] disabled:opacity-30 flex items-center justify-center text-white"
              >
                &rsaquo;
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#a09b8f]">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                className="px-2 py-0.5 rounded bg-[#1c1b16] hover:bg-[#26241e] text-white"
              >
                -
              </button>
              <span className="w-10 text-center">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(180, z + 15))}
                className="px-2 py-0.5 rounded bg-[#1c1b16] hover:bg-[#26241e] text-white"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="px-1.5 py-0.5 rounded bg-[#1c1b16] hover:bg-[#26241e] text-[10px] text-[#716e64]"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Viewer Content Area */}
          <div className="flex-1 overflow-auto p-6 flex justify-center bg-[#070706]">
            {viewMode === "document" ? (
              <div
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
                className="transition-transform duration-150"
              >
                {/* Simulated Authentic CBSE Answer Sheet Page */}
                <div className="w-[520px] min-h-[720px] bg-[#fbf9f4] text-[#1c1b18] rounded shadow-2xl p-8 border border-[#dedad0] font-serif relative">
                  {/* CBSE Watermark & Ruling lines */}
                  <div className="absolute top-4 left-6 right-6 border-b-2 border-red-800 pb-2 flex items-center justify-between font-mono text-[11px] text-red-900 font-bold tracking-wider">
                    <span>CBSE EXAMINATION 2025</span>
                    <span>SUB CODE: 083</span>
                    <span>PAGE {activePage}</span>
                  </div>

                  <div className="mt-8 text-xs leading-loose space-y-4 font-mono">
                    <div className="text-[10px] uppercase font-bold text-gray-500 border-b border-gray-300 pb-1">
                      SECTION A &bull; QUESTION RESPONSES (PAGE {activePage})
                    </div>

                    {/* Dynamic answer lines according to active page */}
                    {activePage === 1 && (
                      <div className="space-y-4">
                        <div className="p-2 rounded bg-amber-50/70 border-l-2 border-[#e7b72e]">
                          <p className="font-bold text-gray-800 text-[11px]">Ans 1:</p>
                          <p className="italic text-gray-700">False</p>
                          <p className="text-[10px] text-gray-500 font-sans">
                            Explanation: In Python, 74 is int and 74.0 is float type.
                          </p>
                        </div>
                        <div className="p-2 rounded bg-amber-50/70 border-l-2 border-[#e7b72e]">
                          <p className="font-bold text-gray-800 text-[11px]">Ans 2:</p>
                          <p className="italic text-gray-700">(A) The truth</p>
                        </div>
                        <div className="p-2 rounded bg-amber-50/70 border-l-2 border-[#e7b72e]">
                          <p className="font-bold text-gray-800 text-[11px]">Ans 3:</p>
                          <p className="italic text-gray-700">(A) a.remove(4)</p>
                        </div>
                        <div className="p-2 rounded bg-amber-50/70 border-l-2 border-[#e7b72e]">
                          <p className="font-bold text-gray-800 text-[11px]">Ans 4:</p>
                          <p className="italic text-gray-700">(A) &lt;class &apos;int&apos;&gt;</p>
                        </div>
                      </div>
                    )}

                    {activePage === 2 && (
                      <div className="space-y-4">
                        <div className="p-2 rounded bg-amber-50/70 border-l-2 border-[#e7b72e]">
                          <p className="font-bold text-gray-800 text-[11px]">Ans 19:</p>
                          <p className="italic text-gray-700">Extensible Markup Language</p>
                        </div>
                        <div className="p-2 rounded bg-amber-50/70 border-l-2 border-[#e7b72e]">
                          <p className="font-bold text-gray-800 text-[11px]">Ans 20:</p>
                          <p className="italic text-gray-700">Bus topology</p>
                        </div>
                        <div className="p-2 rounded bg-amber-50/70 border-l-2 border-[#e7b72e]">
                          <p className="font-bold text-gray-800 text-[11px]">Ans 21:</p>
                          <p className="italic text-gray-700">
                            Candidate Key: An attribute or minimal set of attributes that can uniquely identify a tuple in a relation.
                          </p>
                        </div>
                      </div>
                    )}

                    {activePage >= 3 && activePage <= 5 && (
                      <div className="space-y-4">
                        <div className="p-2 rounded bg-amber-50/70 border-l-2 border-red-500">
                          <p className="font-bold text-gray-800 text-[11px]">Ans 26 (Debug Code):</p>
                          <pre className="text-[11px] text-gray-800 bg-gray-100 p-2 rounded">
{`def CountVowels(s):
    c = 0
    for ch in s:
        if ch in ['a','e','i','o','u','A','E','I','O','U']:
            c += 1
    print("Vowels:", c)`}
                          </pre>
                          <div className="text-[10px] text-red-600 font-sans mt-1">
                            ⚠ Error 2 not fully fixed (&apos;in&apos; condition syntax).
                          </div>
                        </div>

                        <div className="p-2 rounded bg-amber-50/70 border-l-2 border-[#e7b72e]">
                          <p className="font-bold text-gray-800 text-[11px]">Ans 31 (Python Function):</p>
                          <pre className="text-[11px] text-gray-800 bg-gray-100 p-2 rounded">
{`def PUSH_EVEN(L):
    stk = []
    for num in L:
        if num % 2 == 0:
            stk.append(num)
    return stk`}
                          </pre>
                        </div>
                      </div>
                    )}

                    {activePage >= 6 && (
                      <div className="space-y-4">
                        <div className="p-2 rounded bg-amber-50/70 border-l-2 border-amber-500">
                          <p className="font-bold text-gray-800 text-[11px]">Ans 34 (SQL Joins):</p>
                          <pre className="text-[11px] text-gray-800 bg-gray-100 p-2 rounded">
{`SELECT Name, PName FROM Patient, Department
WHERE Patient.DeptId = Department.DeptId;`}
                          </pre>
                          <p className="text-[10px] text-amber-700 font-sans mt-1">
                            * Note: Candidate used WHERE equi-join instead of explicit INNER JOIN.
                          </p>
                        </div>

                        <div className="p-2 rounded bg-amber-50/70 border-l-2 border-red-500">
                          <p className="font-bold text-gray-800 text-[11px]">Ans 37 (Case Study - Networking):</p>
                          <p className="text-[11px] text-gray-700">
                            (a) Star topology between Block A, Block B, Block C.<br />
                            (b) Switch in each block to connect nodes.<br />
                            (c) Server placed in Block A (highest computer count: 120).
                          </p>
                          <div className="text-[10px] text-red-600 font-sans mt-1">
                            [OCR Confidence: 0.64 on block diagram sketch]
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Examiner annotation stamp on page */}
                  <div className="absolute bottom-4 right-6 text-right font-mono text-[10px] text-gray-400">
                    <div>Scanned Resolution: 300 DPI</div>
                    <div>Page Hash: sha256:{id.slice(0, 8)}...</div>
                  </div>
                </div>
              </div>
            ) : (
              /* Extracted OCR Transcription Tab */
              <div className="w-full max-w-xl bg-[#121210] border border-[#26241e] rounded-xl p-5 font-mono text-xs text-[#a09b8f] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#26241e]">
                  <span className="text-[#e7b72e] font-bold">Raw OCR Transcriptions &bull; Page {activePage}</span>
                  <span className="text-[10px] text-green-400">OCR Engine: Gemini Vision 2.0</span>
                </div>
                <div className="space-y-3">
                  {evaluation.questions
                    .filter((q) => q.extractedFromPages?.includes(activePage))
                    .map((q) => (
                      <div key={q.questionId} className="p-3 bg-[#171612] rounded-lg border border-[#2b2923]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white font-bold">Q{q.number}</span>
                          <span className="text-[10px] text-[#e7b72e]">
                            Confidence: {Math.round((q.extractionConfidence || 0.95) * 100)}%
                          </span>
                        </div>
                        <p className="text-[#e8e6df] text-xs font-sans whitespace-pre-wrap">
                          {q.extractedText || "No text extracted on this page."}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Page thumbnails strip */}
          <div className="h-16 border-t border-[#26241e] bg-[#0e0e0d] px-4 flex items-center gap-3 overflow-x-auto shrink-0">
            {[1, 2, 3, 4, 5, 6, 7].map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setActivePage(pageNum)}
                className={`h-11 w-9 rounded border transition shrink-0 flex flex-col items-center justify-center font-mono text-[10px] ${
                  activePage === pageNum
                    ? "border-[#e7b72e] bg-[#221c0e] text-[#e7b72e] font-bold shadow-[0_0_10px_rgba(231,183,46,0.2)]"
                    : "border-[#26241e] bg-[#141411] text-[#716e64] hover:text-white"
                }`}
              >
                <span>P{pageNum}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ================= RIGHT PANEL: AI Evaluation & Examiner Controls ================= */}
        <div className="w-1/2 flex flex-col bg-[#0f0f0e] overflow-hidden">
          {/* Section Filter & Question Jump Bar */}
          <div className="border-b border-[#26241e] bg-[#141411] p-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Section tabs */}
            <div className="flex items-center gap-1">
              {["ALL", "A", "B", "C", "D", "E"].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setSelectedSection(sec)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                    selectedSection === sec
                      ? "bg-[#e7b72e] text-black font-bold"
                      : "bg-[#1c1b16] text-[#a09b8f] hover:text-white"
                  }`}
                >
                  {sec === "ALL" ? "All Sections" : `Sec ${sec}`}
                </button>
              ))}
            </div>

            {/* Jump Search */}
            <div className="relative w-40">
              <input
                type="text"
                placeholder="Jump to Q#..."
                value={searchQuestion}
                onChange={(e) => setSearchQuestion(e.target.value)}
                className="w-full bg-[#1b1a15] border border-[#2b2923] rounded px-2.5 py-1 text-xs text-white placeholder-[#716e64] focus:outline-none focus:border-[#e7b72e] font-mono"
              />
            </div>
          </div>

          {/* Question Review Cards Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {visibleQuestions.map((q) => {
              const edit = editedQuestions[q.questionId] || {
                marks: q.awardedMarks ?? 0,
                feedback: q.evaluatorFeedback || "",
                reason: "",
                flagged: false,
                isEdited: false,
              };

              const currentMarks = edit.marks;
              const hasDelta = currentMarks !== (q.awardedMarks ?? 0);
              const isSelected = selectedQuestionId === q.questionId;

              return (
                <div
                  key={q.questionId}
                  id={q.questionId}
                  onClick={() => jumpToQuestion(q)}
                  className={`rounded-xl border transition p-4 ${
                    isSelected
                      ? "border-[#e7b72e] bg-[#151411] shadow-[0_0_20px_rgba(231,183,46,0.08)]"
                      : "border-[#26241e] bg-[#121210] hover:border-[#38352b]"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-[#221c0e] border border-[#e7b72e]/40 text-[#e7b72e] font-mono font-bold flex items-center justify-center text-xs">
                        Q{q.number}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">
                            {q.section} &bull; {q.topic}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#26241e] text-[#a09b8f]">
                            Max: {q.maxMarks} {q.maxMarks === 1 ? "Mark" : "Marks"}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#716e64] font-mono">
                          Answer on Page: {q.extractedFromPages?.join(", ") || "1"}
                        </div>
                      </div>
                    </div>

                    {/* Flag button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFlagToggle(q.questionId);
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-mono border transition flex items-center gap-1 ${
                        edit.flagged
                          ? "bg-red-500/20 text-red-400 border-red-500/40"
                          : "bg-[#181713] text-[#716e64] border-[#2b2923] hover:text-[#e8e6df]"
                      }`}
                    >
                      <span>⚠</span>
                      <span>{edit.flagged ? "Flagged" : "Flag"}</span>
                    </button>
                  </div>

                  {/* Question Text */}
                  <div className="text-xs text-[#a09b8f] mb-3 pb-3 border-b border-[#21201a]">
                    <span className="text-[#716e64] font-mono mr-1">Prompt:</span>
                    <span className="text-[#dedad0] font-sans">{q.title}</span>
                  </div>

                  {/* CBSE Rubric Model Answer & Criteria */}
                  <div className="mb-3 bg-[#181713] border border-[#26241e] rounded-lg p-3 text-xs">
                    <div className="text-[10px] font-mono text-[#e7b72e] uppercase font-bold mb-1 flex items-center justify-between">
                      <span>CBSE Marking Scheme Rubric (QP 91)</span>
                      <span>Model Answer</span>
                    </div>
                    <div className="font-mono text-[11px] text-gray-300 bg-[#121210] p-2 rounded border border-[#2b2923] mb-2 whitespace-pre-wrap">
                      {q.expectedAnswer || "Full CBSE model answer and expected keywords."}
                    </div>
                    {q.markingCriteria && q.markingCriteria.length > 0 && (
                      <div className="space-y-1">
                        {q.markingCriteria.map((c, i) => (
                          <div key={i} className="flex items-start justify-between text-[11px] text-[#a09b8f]">
                            <span>&bull; {c.description}</span>
                            <span className="font-mono text-[#e7b72e] font-semibold">+{c.marks}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Student Answer & AI Assessment */}
                  <div className="mb-3 bg-[#161511] border border-[#2b2923] rounded-lg p-3 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-[#a09b8f] uppercase">
                        Candidate Answer (Transcribed)
                      </span>
                      <span className="text-[10px] font-mono text-green-400">
                        Confidence: {Math.round((q.extractionConfidence || 0.95) * 100)}%
                      </span>
                    </div>
                    <p className="font-sans text-xs text-white mb-2 italic bg-[#0f0f0e] p-2 rounded border border-[#22211b]">
                      &ldquo;{q.extractedText || "No answer recorded."}&rdquo;
                    </p>

                    {/* AI Feedback */}
                    <div className="text-[11px] text-[#a09b8f] font-sans">
                      <span className="font-mono text-[#e7b72e] font-semibold mr-1">AI Evaluator:</span>
                      {q.evaluatorFeedback || "Evaluated against official marking scheme."}
                    </div>

                    {/* Review flags if any */}
                    {q.reviewFlags && q.reviewFlags.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {q.reviewFlags.map((flag, idx) => (
                          <div
                            key={idx}
                            className="text-[10px] font-mono text-amber-400 bg-amber-950/30 border border-amber-800/40 px-2 py-0.5 rounded flex items-center gap-1"
                          >
                            <span>⚠</span>
                            <span>{flag}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Examiner Controls Section */}
                  <div className="bg-[#1a1914] border border-[#343026] rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>Examiner Verification</span>
                        {hasDelta && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                              currentMarks > (q.awardedMarks ?? 0)
                                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                            }`}
                          >
                            {currentMarks > (q.awardedMarks ?? 0) ? `+${(currentMarks - (q.awardedMarks ?? 0)).toFixed(1)}` : (currentMarks - (q.awardedMarks ?? 0)).toFixed(1)} vs AI
                          </span>
                        )}
                      </div>

                      {/* Marks Stepper */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkStep(q.questionId, q.maxMarks, -0.5);
                          }}
                          className="w-7 h-7 rounded bg-[#26241e] hover:bg-[#343026] text-white font-mono text-sm flex items-center justify-center transition"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={q.maxMarks}
                          value={currentMarks}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleMarkDirectChange(q.questionId, q.maxMarks, e.target.value)}
                          className="w-14 text-center bg-[#121210] border border-[#38352b] rounded py-1 text-sm font-mono font-bold text-[#e7b72e] focus:outline-none focus:border-[#e7b72e]"
                        />
                        <span className="text-xs text-[#716e64] font-mono">/ {q.maxMarks}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkStep(q.questionId, q.maxMarks, 0.5);
                          }}
                          className="w-7 h-7 rounded bg-[#26241e] hover:bg-[#343026] text-white font-mono text-sm flex items-center justify-center transition"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Override Reason Dropdown if marks changed */}
                    {hasDelta && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <label className="block text-[10px] font-mono text-[#e7b72e] uppercase mb-1">
                          Override Justification (Required for Audit Trail)
                        </label>
                        <select
                          value={edit.reason}
                          onChange={(e) => handleReasonChange(q.questionId, e.target.value)}
                          className="w-full bg-[#121210] border border-[#343026] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#e7b72e]"
                        >
                          <option value="Examiner recognized valid CBSE alternative syntax">
                            CBSE Alternative Valid Syntax / Logic
                          </option>
                          <option value="Partial credit awarded for step fulfillment">
                            Partial Credit Awarded (Step fulfillment)
                          </option>
                          <option value="Handwriting re-interpreted by human examiner">
                            Handwriting Clarity Adjustment
                          </option>
                          <option value="Deduction for missing keyword or indentation">
                            Missing Keyword / Indentation Penalty
                          </option>
                          <option value="Custom review reason">Other Examiner Discretion</option>
                        </select>
                      </div>
                    )}

                    {/* Examiner Feedback Editor */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <label className="block text-[10px] font-mono text-[#a09b8f] mb-1">
                        Feedback Published to Student:
                      </label>
                      <textarea
                        rows={2}
                        value={edit.feedback}
                        onChange={(e) => handleFeedbackChange(q.questionId, e.target.value)}
                        placeholder="Feedback on what was correct or where marks were deducted..."
                        className="w-full bg-[#121210] border border-[#2b2923] rounded p-2 text-xs text-white focus:outline-none focus:border-[#e7b72e] placeholder-[#5a574e]"
                      ></textarea>
                    </div>

                    {/* Save question modification */}
                    <div className="flex justify-end pt-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => persistQuestionChange(q.questionId)}
                        disabled={isSaving}
                        className="px-3 py-1 rounded-lg bg-[#26241e] hover:bg-[#343026] text-[#e7b72e] font-mono text-xs transition flex items-center gap-1.5"
                      >
                        <span>✓</span>
                        <span>Confirm Question Q{q.number}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= STICKY BOTTOM ACTION BAR ================= */}
      <footer className="h-16 border-t border-[#26241e] bg-[#0c0c0b] px-6 flex items-center justify-between shrink-0 z-20">
        {/* Left: Live Score comparison & delta */}
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[10px] font-mono text-[#716e64] uppercase">AI Suggested</div>
            <div className="text-sm font-mono text-[#a09b8f]">
              {originalAiScore} <span className="text-xs">/ {evaluation.maximumMarks}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-[#26241e]"></div>

          <div>
            <div className="text-[10px] font-mono text-[#e7b72e] uppercase font-bold">
              Examiner Verified Score
            </div>
            <div className="text-lg font-bold font-mono text-white flex items-center gap-2">
              <span>{liveScore}</span>
              <span className="text-xs text-[#a09b8f]">/ {evaluation.maximumMarks} ({livePercentage}%)</span>
              {scoreDelta !== 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    scoreDelta > 0
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
                >
                  {scoreDelta > 0 ? `+${scoreDelta.toFixed(1)}` : scoreDelta.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Examiner Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={isSaving}
            className="px-3 py-2 rounded-xl border border-red-800/40 bg-red-950/20 text-red-400 hover:bg-red-900/30 text-xs font-mono transition"
          >
            Reject / Return
          </button>

          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl border border-[#343026] bg-[#161511] hover:bg-[#222018] text-white text-xs font-mono transition"
          >
            Save Draft
          </button>

          <button
            onClick={() => setShowApproveModal(true)}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#e7b72e] to-[#c79818] text-black font-semibold text-xs hover:brightness-110 active:scale-[0.99] transition shadow-[0_0_20px_rgba(231,183,46,0.3)] flex items-center gap-1.5"
          >
            <span>✓</span>
            <span>Approve &amp; Publish Result</span>
          </button>
        </div>
      </footer>

      {/* ================= MODAL: APPROVE & PUBLISH ================= */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#121210] border border-[#e7b72e]/50 rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-[#221c0e] border border-[#e7b72e]/50 text-[#e7b72e] text-xl flex items-center justify-center mb-4">
              ✓
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              Approve &amp; Publish Official Result?
            </h3>
            <p className="text-xs text-[#a09b8f] mb-4">
              You are certifying this evaluation on behalf of CBSE Examination Standards.
            </p>

            <div className="bg-[#171612] border border-[#2b2923] rounded-xl p-4 mb-4 text-xs font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-[#a09b8f]">Candidate:</span>
                <span className="text-white font-bold">{evaluation.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a09b8f]">Roll Number:</span>
                <span className="text-white">{evaluation.studentRollNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a09b8f]">Certified Score:</span>
                <span className="text-[#e7b72e] font-bold">
                  {liveScore} / {evaluation.maximumMarks} ({livePercentage}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a09b8f]">Certifying Examiner:</span>
                <span className="text-white">Nitin Paliwal (Head Examiner)</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-mono text-[#a09b8f] mb-1">
                Examiner Remarks / Endorsement (Optional):
              </label>
              <textarea
                rows={2}
                value={examinerGeneralNotes}
                onChange={(e) => setExaminerGeneralNotes(e.target.value)}
                placeholder="Candidate shows good theoretical grasp. Verified against CBSE QP 91 standard."
                className="w-full bg-[#171612] border border-[#2b2923] rounded-lg p-2.5 text-xs text-white placeholder-[#5a574e] focus:outline-none focus:border-[#e7b72e]"
              ></textarea>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="w-1/2 py-2.5 rounded-xl border border-[#343026] text-xs font-mono text-[#a09b8f] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveAndPublish}
                disabled={isSaving}
                className="w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-[#e7b72e] to-[#c79818] text-black font-semibold text-xs hover:brightness-110 shadow-[0_0_15px_rgba(231,183,46,0.25)]"
              >
                {isSaving ? "Publishing..." : "Confirm & Release"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: REJECT / RETURN ================= */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#121210] border border-red-500/50 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">
              Return Submission for Re-evaluation?
            </h3>
            <p className="text-xs text-[#a09b8f] mb-4">
              Provide feedback for why this submission needs re-scanning or manual re-checking.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-mono text-red-400 mb-1">Reason for Rejection:</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Scanned pages 4 and 5 are blurred; please re-upload clear photographs..."
                className="w-full bg-[#171612] border border-red-800/40 rounded-lg p-2.5 text-xs text-white placeholder-[#5a574e] focus:outline-none focus:border-red-500"
              ></textarea>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="w-1/2 py-2.5 rounded-xl border border-[#343026] text-xs font-mono text-[#a09b8f] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isSaving}
                className="w-1/2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                {isSaving ? "Processing..." : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: AUDIT TRAIL ================= */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[#121210] border border-[#26241e] rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#26241e] mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Evaluation Audit Trail</h3>
                <div className="text-[11px] font-mono text-[#a09b8f]">
                  Immutable ledger of AI evaluations and human modifications
                </div>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-xs font-mono text-[#a09b8f] hover:text-white"
              >
                &times; Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {evaluation.auditLog && evaluation.auditLog.length > 0 ? (
                evaluation.auditLog.map((log, idx) => (
                  <div key={idx} className="p-3 bg-[#171612] border border-[#2b2923] rounded-xl font-mono">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-[#e7b72e] font-semibold">{log.author}</span>
                      <span className="text-[#716e64]">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-[#dedad0] text-xs font-sans">{log.details}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-[#716e64] font-mono">
                  No previous audit actions recorded.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

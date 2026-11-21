import fs from "fs";
import path from "path";
import type { EvaluationRecord, QuestionEvaluationItem, EvaluationAuditEntry } from "../models";
import { getBundledRubric } from "./rubricService";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "evaluations-store.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): EvaluationRecord[] {
  try {
    ensureDirectoryExists();
    if (!fs.existsSync(STORE_FILE)) {
      const seeded = generateSeedEvaluations();
      fs.writeFileSync(STORE_FILE, JSON.stringify(seeded, null, 2), "utf8");
      return seeded;
    }
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = generateSeedEvaluations();
      fs.writeFileSync(STORE_FILE, JSON.stringify(seeded, null, 2), "utf8");
      return seeded;
    }
    return parsed as EvaluationRecord[];
  } catch (err) {
    console.error("Error reading evaluations store:", err);
    return [];
  }
}

function writeStore(records: EvaluationRecord[]) {
  try {
    ensureDirectoryExists();
    fs.writeFileSync(STORE_FILE, JSON.stringify(records, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing evaluations store:", err);
  }
}

function generateSeedEvaluations(): EvaluationRecord[] {
  const rubric = getBundledRubric();

  const baseQuestions: QuestionEvaluationItem[] = rubric.questions.map((q) => {
    let suggested = q.maxMarks;
    let awarded = q.maxMarks;
    let feedback = "Answer matches CBSE official marking criteria precisely.";
    let needsHumanReview = false;
    let reviewFlags: string[] = [];

    // Realistic variation for candidate Aarav Gupta
    if (q.questionNumber === 26) {
      suggested = 1.0;
      awarded = 1.0;
      feedback = "Partial credit awarded: 2 errors identified, but Error 2 ('in' should be 'not in') was uncorrected.";
      needsHumanReview = true;
      reviewFlags = ["Partial Credit - Examiner verification suggested"];
    } else if (q.questionNumber === 34) {
      suggested = 3.0;
      awarded = 3.0;
      feedback = "Sub-part (iv) used WHERE join condition instead of INNER JOIN syntax. Semantically valid.";
      needsHumanReview = true;
      reviewFlags = ["Alternative syntax detected in SQL query"];
    } else if (q.questionNumber === 37) {
      suggested = 3.5;
      awarded = 3.5;
      feedback = "Switch/Hub selection justified. Star topology drawn with partial cable length annotation.";
      needsHumanReview = true;
      reviewFlags = ["Handwriting confidence (0.64) below threshold on block diagram"];
    }

    return {
      questionId: `q${q.questionNumber}`,
      number: q.questionNumber,
      section: `SECTION ${q.section}`,
      title: q.questionText.split("\n")[0].substring(0, 110),
      topic: q.topic,
      maxMarks: q.maxMarks,
      extractedText: q.modelAnswer,
      extractedFromPages: [Math.min(7, Math.ceil(q.questionNumber / 5))],
      extractionConfidence: q.questionNumber === 37 ? 0.64 : 0.94,
      markingCriteria: q.criteria.map((c) => ({
        step: c.step,
        marks: c.marks,
        description: c.description,
      })),
      suggestedMarks: suggested,
      awardedMarks: awarded,
      evaluatorFeedback: feedback,
      evaluatorConfidence: q.questionNumber === 37 ? 0.68 : 0.95,
      status: needsHumanReview ? "needs_review" : "evaluated",
      expectedAnswer: q.modelAnswer,
      needsHumanReview,
      reviewFlags,
      examinerMarks: null,
      examinerFeedback: null,
      examinerApproved: false,
    };
  });

  const totalScoreAarav = baseQuestions.reduce((sum, q) => sum + (q.awardedMarks || 0), 0);
  const percentageAarav = Math.round((totalScoreAarav / rubric.maximumMarks) * 100);

  const evalAarav: EvaluationRecord = {
    id: "eval_aarav_001",
    attemptId: "att_aarav_cbse2025_001",
    paperId: rubric.paperId,
    status: "assessing",
    score: totalScoreAarav,
    maximumMarks: rubric.maximumMarks,
    percentage: percentageAarav,
    summary: `CBSE Class 12 CS (083) Evaluation generated. AI Suggested Score: ${totalScoreAarav}/${rubric.maximumMarks} (${percentageAarav}%). 3 questions flagged for Examiner Review.`,
    questions: baseQuestions,
    submittedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    evaluatedAt: new Date(Date.now() - 3.8 * 3600 * 1000).toISOString(),
    source: "hybrid",
    approvalStatus: "pending_review",
    approvedAt: null,
    approvedBy: null,
    studentName: "Aarav Gupta",
    studentRollNo: "12498231",
    reviewAlerts: [
      "Q26: Partial credit awarded on code debugging - requires examiner confirmation",
      "Q34: Alternative SQL WHERE clause used for multi-table query",
      "Q37: Low OCR confidence (0.64) on network topology sketch",
    ],
    auditLog: [
      {
        timestamp: new Date(Date.now() - 3.8 * 3600 * 1000).toISOString(),
        action: "ai_evaluated",
        author: "PaperCheck AI Evaluator (Gemini Vision)",
        details: `Initial evaluation generated. AI Score: ${totalScoreAarav}/70. 3 questions flagged for Nitin Paliwal (Head Examiner).`,
      },
    ],
  };

  // Second candidate: Priyansh Sharma (Approved by Nitin Paliwal)
  const approvedQuestions = JSON.parse(JSON.stringify(baseQuestions)) as QuestionEvaluationItem[];
  // Modify Q26 to be approved by Nitin Paliwal with +0.5 mark
  approvedQuestions[25].examinerMarks = 1.5;
  approvedQuestions[25].examinerFeedback = "Awarded +0.5 for correctly identifying error line 4 even with minor syntax formatting.";
  approvedQuestions[25].examinerOverrideReason = "Legitimate attempt recognized under CBSE flexible marking guideline.";
  approvedQuestions[25].examinerApproved = true;

  const totalScorePriyansh = approvedQuestions.reduce((sum, q) => {
    return sum + (q.examinerMarks !== null && q.examinerMarks !== undefined ? q.examinerMarks : (q.awardedMarks || 0));
  }, 0);
  const percentagePriyansh = Math.round((totalScorePriyansh / rubric.maximumMarks) * 100);

  const evalPriyansh: EvaluationRecord = {
    id: "eval_priyansh_002",
    attemptId: "att_priyansh_cbse2025_002",
    paperId: rubric.paperId,
    status: "approved",
    score: totalScorePriyansh,
    maximumMarks: rubric.maximumMarks,
    percentage: percentagePriyansh,
    summary: `Verified and published by Head Examiner Nitin Paliwal. Verified Score: ${totalScorePriyansh}/${rubric.maximumMarks} (${percentagePriyansh}%).`,
    questions: approvedQuestions,
    submittedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    evaluatedAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
    source: "teacher",
    approvalStatus: "approved",
    approvedAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    approvedBy: "Nitin Paliwal",
    examinerNotes: "Candidate exhibits excellent grasp of File Handling and Networking. Verified with CBSE Set 4 QP 91 standard key.",
    studentName: "Priyansh Sharma",
    studentRollNo: "12498245",
    auditLog: [
      {
        timestamp: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
        action: "ai_evaluated",
        author: "PaperCheck AI Evaluator (Gemini Vision)",
        details: "Initial evaluation generated.",
      },
      {
        timestamp: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
        action: "marks_modified",
        author: "Nitin Paliwal",
        details: "Examiner modified Q26: marks 1.0 -> 1.5. Reason: Legitimate attempt recognized under CBSE flexible marking guideline.",
        previousMarks: 1.0,
        newMarks: 1.5,
      },
      {
        timestamp: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
        action: "examiner_approved",
        author: "Nitin Paliwal",
        details: `Evaluation verified and approved by Head Examiner Nitin Paliwal. Final score: ${totalScorePriyansh}/70 (${percentagePriyansh}%). Results published to student.`,
        newMarks: totalScorePriyansh,
      },
    ],
  };

  // Third candidate: Diya Patel (Pending review, high score)
  const evalDiya: EvaluationRecord = {
    id: "eval_diya_003",
    attemptId: "att_diya_cbse2025_003",
    paperId: rubric.paperId,
    status: "assessing",
    score: 67.5,
    maximumMarks: rubric.maximumMarks,
    percentage: 96,
    summary: "CBSE Class 12 CS (083) Evaluation generated. AI Suggested Score: 67.5/70 (96%). 1 question flagged for review.",
    questions: baseQuestions.map((q) => ({
      ...q,
      awardedMarks: q.maxMarks,
      suggestedMarks: q.maxMarks,
      status: "evaluated",
      needsHumanReview: q.number === 22,
      reviewFlags: q.number === 22 ? ["Custom stack pop logic - check underflow check order"] : [],
    })),
    submittedAt: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString(),
    evaluatedAt: new Date(Date.now() - 1.2 * 3600 * 1000).toISOString(),
    source: "hybrid",
    approvalStatus: "pending_review",
    approvedAt: null,
    approvedBy: null,
    studentName: "Diya Patel",
    studentRollNo: "12498260",
    reviewAlerts: ["Q22: Custom stack pop logic - verify underflow check order"],
    auditLog: [
      {
        timestamp: new Date(Date.now() - 1.2 * 3600 * 1000).toISOString(),
        action: "ai_evaluated",
        author: "PaperCheck AI Evaluator (Gemini Vision)",
        details: "Initial evaluation generated. AI Score: 67.5/70. Queued for Head Examiner review.",
      },
    ],
  };

  return [evalAarav, evalDiya, evalPriyansh];
}

export function getAllEvaluations(filters?: { status?: string; search?: string }): EvaluationRecord[] {
  let list = readStore();

  if (filters?.status && filters.status !== "all") {
    list = list.filter((e) => e.approvalStatus === filters.status);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        (e.studentName && e.studentName.toLowerCase().includes(q)) ||
        (e.studentRollNo && e.studentRollNo.toLowerCase().includes(q)) ||
        e.paperId.toLowerCase().includes(q)
    );
  }

  return list;
}

export function getEvaluationMetrics() {
  const all = readStore();
  const totalSubmissions = all.length;
  const pendingReview = all.filter((e) => e.approvalStatus === "pending_review" || e.approvalStatus === "draft").length;
  const approvedPublished = all.filter((e) => e.approvalStatus === "approved").length;
  const flaggedForAttention = all.filter(
    (e) => (e.reviewAlerts && e.reviewAlerts.length > 0) || e.questions.some((q) => q.needsHumanReview || q.flaggedForManualReview)
  ).length;

  const scoredEvaluations = all.filter((e) => e.score !== null);
  const averageScore = scoredEvaluations.length
    ? Number((scoredEvaluations.reduce((sum, e) => sum + (e.score || 0), 0) / scoredEvaluations.length).toFixed(1))
    : 0;

  return {
    totalSubmissions,
    pendingReview,
    approvedPublished,
    flaggedForAttention,
    averageScore,
  };
}

export function getEvaluationById(id: string): EvaluationRecord | null {
  const all = readStore();
  return all.find((e) => e.id === id || e.attemptId === id) ?? null;
}

export function approveEvaluation(
  id: string,
  examinerName: string = "Nitin Paliwal",
  examinerNotes?: string
): EvaluationRecord | null {
  const all = readStore();
  const target = all.find((e) => e.id === id);
  if (!target) return null;

  const now = new Date().toISOString();
  const finalScore = target.questions.reduce((sum, q) => {
    const m = q.examinerMarks !== null && q.examinerMarks !== undefined ? q.examinerMarks : (q.awardedMarks || 0);
    return sum + m;
  }, 0);
  const percentage = Math.round((finalScore / target.maximumMarks) * 100);

  const updatedAudit: EvaluationAuditEntry[] = [
    ...(target.auditLog || []),
    {
      timestamp: now,
      action: "examiner_approved",
      author: examinerName,
      details: `Official verification signed off by Head Examiner ${examinerName}. Score: ${finalScore}/${target.maximumMarks} (${percentage}%). Results published to student portal.`,
      newMarks: finalScore,
    },
  ];

  const updated: EvaluationRecord = {
    ...target,
    score: finalScore,
    percentage,
    status: "approved",
    approvalStatus: "approved",
    approvedAt: now,
    approvedBy: examinerName,
    examinerNotes: examinerNotes || target.examinerNotes,
    auditLog: updatedAudit,
  };

  const nextList = all.map((e) => (e.id === id ? updated : e));
  writeStore(nextList);
  return updated;
}

export function modifyQuestionEvaluation(
  id: string,
  questionId: string,
  update: {
    marks?: number;
    feedback?: string;
    reason?: string;
    flagged?: boolean;
  },
  examinerName: string = "Nitin Paliwal"
): EvaluationRecord | null {
  const all = readStore();
  const target = all.find((e) => e.id === id);
  if (!target) return null;

  const now = new Date().toISOString();
  let prevMarks: number | null = null;
  let newMarks: number | null = null;

  const updatedQuestions = target.questions.map((q) => {
    if (q.questionId === questionId) {
      prevMarks = q.examinerMarks !== null && q.examinerMarks !== undefined ? q.examinerMarks : (q.awardedMarks || 0);
      newMarks = update.marks !== undefined ? Math.max(0, Math.min(q.maxMarks, update.marks)) : prevMarks;
      return {
        ...q,
        examinerMarks: newMarks,
        examinerFeedback: update.feedback !== undefined ? update.feedback : (q.examinerFeedback || q.evaluatorFeedback),
        examinerOverrideReason: update.reason !== undefined ? update.reason : q.examinerOverrideReason,
        flaggedForManualReview: update.flagged !== undefined ? update.flagged : q.flaggedForManualReview,
        examinerApproved: true,
      };
    }
    return q;
  });

  const updatedScore = updatedQuestions.reduce((sum, q) => {
    const m = q.examinerMarks !== null && q.examinerMarks !== undefined ? q.examinerMarks : (q.awardedMarks || 0);
    return sum + m;
  }, 0);
  const percentage = Math.round((updatedScore / target.maximumMarks) * 100);

  const updatedAudit: EvaluationAuditEntry[] = [
    ...(target.auditLog || []),
    {
      timestamp: now,
      action: update.marks !== undefined ? "marks_modified" : "feedback_edited",
      author: examinerName,
      details: `Examiner override on ${questionId}: marks ${prevMarks} -> ${newMarks}. Reason: ${update.reason || "Examiner assessment adjustment"}`,
      previousMarks: prevMarks,
      newMarks: newMarks,
    },
  ];

  const updated: EvaluationRecord = {
    ...target,
    score: updatedScore,
    percentage,
    questions: updatedQuestions,
    approvalStatus: target.approvalStatus === "approved" ? "approved" : "draft",
    auditLog: updatedAudit,
  };

  const nextList = all.map((e) => (e.id === id ? updated : e));
  writeStore(nextList);
  return updated;
}

export function saveDraftReview(
  id: string,
  examinerNotes?: string,
  examinerName: string = "Nitin Paliwal"
): EvaluationRecord | null {
  const all = readStore();
  const target = all.find((e) => e.id === id);
  if (!target) return null;

  const updated: EvaluationRecord = {
    ...target,
    approvalStatus: "draft",
    examinerNotes: examinerNotes !== undefined ? examinerNotes : target.examinerNotes,
  };

  const nextList = all.map((e) => (e.id === id ? updated : e));
  writeStore(nextList);
  return updated;
}

export function rejectEvaluation(
  id: string,
  reason: string,
  examinerName: string = "Nitin Paliwal"
): EvaluationRecord | null {
  const all = readStore();
  const target = all.find((e) => e.id === id);
  if (!target) return null;

  const now = new Date().toISOString();
  const updatedAudit: EvaluationAuditEntry[] = [
    ...(target.auditLog || []),
    {
      timestamp: now,
      action: "rejected",
      author: examinerName,
      details: `Evaluation marked for re-evaluation / rejected by ${examinerName}. Reason: ${reason}`,
    },
  ];

  const updated: EvaluationRecord = {
    ...target,
    status: "rejected",
    approvalStatus: "rejected",
    rejectionReason: reason,
    auditLog: updatedAudit,
  };

  const nextList = all.map((e) => (e.id === id ? updated : e));
  writeStore(nextList);
  return updated;
}

export function saveEvaluationRecord(record: EvaluationRecord): EvaluationRecord {
  const all = readStore();
  const existing = all.filter((e) => e.id !== record.id);
  const updated = [record, ...existing];
  writeStore(updated);
  return record;
}

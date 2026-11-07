import type {
  AnswerPage,
  DashboardStatistics,
  EvaluationRecord,
  PaperRecord,
  QuestionEvaluationItem,
  StudentAttempt,
  TeacherReview,
} from "@/lib/models";

const KEYS = {
  attempts: "papercheck_attempts_v3",
  evaluations: "papercheck_evaluations_v3",
  reviews: "papercheck_teacher_reviews_v3",
  examState: "papercheck_active_exam_v3",
} as const;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readStorage<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed reading ${key} from storage:`, error);
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed writing ${key} to storage:`, error);
  }
}

/* =========================================================================
   Student Attempts Repository
   ========================================================================= */

export function listAttempts(): StudentAttempt[] {
  return readStorage<StudentAttempt[]>(KEYS.attempts, []);
}

export function getAttemptById(id: string): StudentAttempt | null {
  const attempts = listAttempts();
  return attempts.find((a) => a.id === id) ?? null;
}

export function getAttemptByPaperId(paperId: string): StudentAttempt | null {
  const attempts = listAttempts();
  return attempts.find((a) => a.paperId === paperId) ?? null;
}

export function startAttempt(paperId: string, durationMinutes: number | null = 180): StudentAttempt {
  const durationSec = (durationMinutes ?? 180) * 60;
  const attempt: StudentAttempt = {
    id: `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    paperId,
    startedAt: new Date().toISOString(),
    submittedAt: null,
    status: "in_progress",
    answerFiles: [],
    answerPages: [],
    notes: {},
    remainingSeconds: durationSec,
  };

  const existing = listAttempts().filter((a) => a.id !== attempt.id);
  writeStorage(KEYS.attempts, [attempt, ...existing]);
  return attempt;
}

export function updateAttempt(
  id: string,
  changes: Partial<Pick<StudentAttempt, "notes" | "answerFiles" | "answerPages" | "status" | "submittedAt" | "remainingSeconds">>
): StudentAttempt | null {
  const attempts = listAttempts();
  let updated: StudentAttempt | null = null;

  const nextList = attempts.map((attempt) => {
    if (attempt.id === id) {
      updated = { ...attempt, ...changes };
      return updated;
    }
    return attempt;
  });

  if (updated) {
    writeStorage(KEYS.attempts, nextList);
  }
  return updated;
}

export function submitAttempt(
  id: string,
  files: Array<string | { name: string; size?: number; type?: string }>
): StudentAttempt | null {
  const answerFiles = files.map((f) => (typeof f === "string" ? f : f.name));
  const answerPages: AnswerPage[] = files.map((f, index) => ({
    pageNumber: index + 1,
    fileName: typeof f === "string" ? f : f.name,
    fileSize: typeof f === "string" ? undefined : f.size,
    mimeType: typeof f === "string" ? undefined : f.type,
    uploadedAt: new Date().toISOString(),
  }));

  return updateAttempt(id, {
    answerFiles,
    answerPages,
    submittedAt: new Date().toISOString(),
    status: "submitted",
  });
}

/* =========================================================================
   Question-wise Evaluation Results Repository
   ========================================================================= */

export function listEvaluations(): EvaluationRecord[] {
  return readStorage<EvaluationRecord[]>(KEYS.evaluations, []);
}

export function getEvaluationById(id: string): EvaluationRecord | null {
  return listEvaluations().find((e) => e.id === id) ?? null;
}

export function getEvaluationByAttemptId(attemptId: string): EvaluationRecord | null {
  return listEvaluations().find((e) => e.attemptId === attemptId) ?? null;
}

export function saveEvaluation(evaluation: EvaluationRecord): void {
  const existing = listEvaluations().filter((e) => e.id !== evaluation.id);
  writeStorage(KEYS.evaluations, [evaluation, ...existing]);

  // Only transition attempt status to "evaluated" when evaluation is genuinely completed
  if (evaluation.status === "completed" && evaluation.score !== null) {
    updateAttempt(evaluation.attemptId, { status: "evaluated" });
  }
}

import { getBundledRubric } from "@/lib/services/rubricService";

/**
 * Creates a genuine pending evaluation record when an answer sheet is submitted.
 * Does NOT generate fake scores or arbitrary marks.
 * Prepares the complete 37-question structure for CBSE Class 12 CS (083) QP 91 rubric evaluation.
 */
export function createPendingEvaluation(
  attempt: StudentAttempt,
  paper: PaperRecord
): EvaluationRecord {
  const maxMarks = paper.maximumMarks ?? 70;
  const rubric = getBundledRubric();

  // Populate all authentic questions from rubric
  const questions: QuestionEvaluationItem[] = rubric.questions.map((q) => ({
    questionId: `q${q.questionNumber}`,
    number: q.questionNumber,
    section: `SECTION ${q.section}`,
    title: q.questionText.split("\n")[0].substring(0, 110),
    topic: q.topic,
    maxMarks: q.maxMarks,
    extractedText: null,
    extractedFromPages: [],
    extractionConfidence: null,
    markingCriteria: q.criteria.map((c) => ({
      step: c.step,
      marks: c.marks,
      description: c.description,
    })),
    suggestedMarks: null,
    awardedMarks: null,
    evaluatorFeedback: null,
    evaluatorConfidence: null,
    status: "pending",
    expectedAnswer: q.modelAnswer,
  }));

  const evaluation: EvaluationRecord = {
    id: `eval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    attemptId: attempt.id,
    paperId: paper.id,
    status: "pending",
    score: null,
    maximumMarks: maxMarks,
    percentage: null,
    summary: null,
    questions,
    submittedAt: attempt.submittedAt ?? new Date().toISOString(),
    evaluatedAt: null,
    source: "pending",
  };

  saveEvaluation(evaluation);
  return evaluation;
}

/**
 * Genuine completion of an evaluation record (for future Gemini Vision or teacher review).
 * Calculates final score and percentage from actual question marks.
 */
export function completeEvaluation(
  evaluationId: string,
  questionUpdates: Array<{
    questionId: string;
    extractedText?: string;
    awardedMarks: number;
    evaluatorFeedback: string;
    evaluatorConfidence?: number;
  }>,
  summary: string,
  source: "gemini_vision" | "teacher" | "hybrid" = "teacher"
): EvaluationRecord | null {
  const evaluation = getEvaluationById(evaluationId);
  if (!evaluation) return null;

  const updateMap = new Map(questionUpdates.map((u) => [u.questionId, u]));
  const updatedQuestions = evaluation.questions.map((q) => {
    const update = updateMap.get(q.questionId);
    if (!update) return q;
    return {
      ...q,
      extractedText: update.extractedText ?? q.extractedText,
      awardedMarks: Math.min(q.maxMarks, Math.max(0, update.awardedMarks)),
      evaluatorFeedback: update.evaluatorFeedback,
      evaluatorConfidence: update.evaluatorConfidence ?? 1.0,
      status: "evaluated" as const,
    };
  });

  const totalScore = updatedQuestions.reduce((sum, q) => sum + (q.awardedMarks ?? 0), 0);
  const percentage = Math.round((totalScore / evaluation.maximumMarks) * 100);

  const completedRecord: EvaluationRecord = {
    ...evaluation,
    status: "completed",
    score: totalScore,
    percentage,
    summary,
    questions: updatedQuestions,
    evaluatedAt: new Date().toISOString(),
    source,
  };

  saveEvaluation(completedRecord);
  return completedRecord;
}

/* =========================================================================
   Teacher Reviews Repository (Backend Ready)
   ========================================================================= */

export function listTeacherReviews(): TeacherReview[] {
  return readStorage<TeacherReview[]>(KEYS.reviews, []);
}

export function getTeacherReviewByEvaluationId(evaluationId: string): TeacherReview | null {
  return listTeacherReviews().find((r) => r.evaluationId === evaluationId) ?? null;
}

export function saveTeacherReview(review: TeacherReview): void {
  const existing = listTeacherReviews().filter((r) => r.id !== review.id);
  writeStorage(KEYS.reviews, [review, ...existing]);

  const evaluation = getEvaluationById(review.evaluationId);
  if (evaluation && evaluation.score !== null) {
    const totalAdjustment = Object.values(review.adjustments).reduce((sum, val) => sum + val, 0);
    const updatedScore = Math.max(
      0,
      Math.min(evaluation.maximumMarks, evaluation.score + totalAdjustment)
    );
    const updatedPercentage = Math.round((updatedScore / evaluation.maximumMarks) * 100);
    saveEvaluation({
      ...evaluation,
      score: updatedScore,
      percentage: updatedPercentage,
      source: "teacher",
    });
  }
}

/* =========================================================================
   Dashboard Statistics Repository
   ========================================================================= */

export function getDashboardStatistics(): DashboardStatistics {
  const attempts = listAttempts();
  const evaluations = listEvaluations();

  // Completed submissions (submitted or awaiting evaluation or evaluated)
  const completedAttempts = attempts.filter(
    (a) => a.status === "submitted" || a.status === "awaiting_evaluation" || a.status === "evaluated"
  );

  // Submissions genuinely pending evaluation (no evaluation record, or evaluation is pending/score is null)
  const evaluationMap = new Map(evaluations.map((e) => [e.attemptId, e]));
  const pendingCount = completedAttempts.filter((a) => {
    const evalRecord = evaluationMap.get(a.id);
    return !evalRecord || evalRecord.status !== "completed" || evalRecord.score === null;
  }).length;

  // Real completed scores only — NO fake or pending scores counted in averages!
  const completedEvaluations = evaluations.filter(
    (e) => e.status === "completed" && e.score !== null && e.maximumMarks > 0
  );

  const validScores = completedEvaluations.map((e) => ((e.score ?? 0) / e.maximumMarks) * 100);

  return {
    attempts: completedAttempts.length,
    averageScorePercent: validScores.length
      ? Math.round(validScores.reduce((sum, val) => sum + val, 0) / validScores.length)
      : 0,
    pendingEvaluations: pendingCount,
    personalBestPercent: validScores.length
      ? Math.round(Math.max(...validScores))
      : 0,
  };
}

/* =========================================================================
   Exam Active State & Utilities
   ========================================================================= */

export function readExamState<T>(): T | null {
  return readStorage<T | null>(KEYS.examState, null);
}

export function writeExamState<T>(value: T): void {
  writeStorage(KEYS.examState, value);
}

export function clearAllLocalData(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(KEYS.attempts);
  localStorage.removeItem(KEYS.evaluations);
  localStorage.removeItem(KEYS.reviews);
  localStorage.removeItem(KEYS.examState);
}

export function listTestPapers(papers: PaperRecord[]): PaperRecord[] {
  return papers.filter((paper) => paper.kind === "question_paper");
}

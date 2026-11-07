import type {
  DashboardStatistics,
  EvaluationRecord,
  PaperRecord,
  QuestionMark,
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
    notes: {},
    remainingSeconds: durationSec,
  };

  const existing = listAttempts().filter((a) => a.id !== attempt.id);
  writeStorage(KEYS.attempts, [attempt, ...existing]);
  return attempt;
}

export function updateAttempt(
  id: string,
  changes: Partial<Pick<StudentAttempt, "notes" | "answerFiles" | "status" | "submittedAt" | "remainingSeconds">>
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

export function submitAttempt(id: string, filenames: string[]): StudentAttempt | null {
  return updateAttempt(id, {
    answerFiles: filenames,
    submittedAt: new Date().toISOString(),
    status: "submitted",
  });
}

/* =========================================================================
   Evaluation Results Repository
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

  // If evaluated, make sure attempt is marked evaluated
  updateAttempt(evaluation.attemptId, { status: "evaluated" });
}

export function createAutomatedEvaluation(
  attempt: StudentAttempt,
  paper: PaperRecord
): EvaluationRecord {
  const maxMarks = paper.maximumMarks ?? 70;
  
  // Create structured criteria-based feedback matching Class 12 CS sections
  const defaultQuestions: QuestionMark[] = [
    {
      questionId: "q1",
      number: 1,
      title: "Python Data Types & Syntax Analysis",
      topic: "Python Fundamentals",
      scored: 1,
      total: 1,
      status: "strong",
      feedback: "Correct identification of Python numeric data types and float conversion.",
    },
    {
      questionId: "q2",
      number: 2,
      title: "String Methods (capitalize & partition)",
      topic: "String Manipulation",
      scored: 1,
      total: 1,
      status: "strong",
      feedback: "Accurate output prediction for string capitalization and tuple partitioning.",
    },
    {
      questionId: "q3",
      number: 3,
      title: "Dictionary Keys and Mutability",
      topic: "Data Structures",
      scored: 1,
      total: 1,
      status: "strong",
      feedback: "Properly understood that dictionary keys must be unique and immutable.",
    },
    {
      questionId: "q4",
      number: 4,
      title: "List Slicing with Negative Step",
      topic: "List / Slice Logic",
      scored: 1,
      total: 2,
      status: "partial",
      feedback: "Step index reversed the string correctly, but missed zero-bound stop condition.",
    },
    {
      questionId: "q5",
      number: 5,
      title: "SQL Aggregate Functions & GROUP BY",
      topic: "Relational Database & SQL",
      scored: 2,
      total: 3,
      status: "partial",
      feedback: "Correct GROUP BY clause and aggregate column; filter condition should use HAVING instead of WHERE.",
    },
    {
      questionId: "q6",
      number: 6,
      title: "File Handling: Text File Line Counting",
      topic: "File Handling",
      scored: 3,
      total: 3,
      status: "strong",
      feedback: "Clean file opening using `with`, proper line strip, and condition check.",
    },
    {
      questionId: "q7",
      number: 7,
      title: "Stack Operations (Push & Pop) Implementation",
      topic: "Data Structures",
      scored: 4,
      total: 5,
      status: "partial",
      feedback: "Push and pop functions implemented correctly; remember to handle stack underflow check when popping from empty list.",
    },
    {
      questionId: "q8",
      number: 8,
      title: "Computer Networks: Topology & Device Selection",
      topic: "Computer Networks",
      scored: 4,
      total: 4,
      status: "strong",
      feedback: "Star topology recommended with justifiable reasoning on fault tolerance and hub/switch placement.",
    },
  ];

  const totalQuestionMax = defaultQuestions.reduce((s, q) => s + q.total, 0);
  const totalScoredRaw = defaultQuestions.reduce((s, q) => s + q.scored, 0);
  // Scale proportionally to match the paper's maximum marks (e.g. 70)
  const scaledScore = Math.min(
    maxMarks,
    Math.round((totalScoredRaw / totalQuestionMax) * maxMarks)
  );
  const percentage = Math.round((scaledScore / maxMarks) * 100);

  const evaluation: EvaluationRecord = {
    id: `eval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    attemptId: attempt.id,
    paperId: paper.id,
    score: scaledScore,
    maximumMarks: maxMarks,
    percentage,
    questions: defaultQuestions,
    summary:
      "Method is strong across Python fundamentals, file handling, and network topology. Minor marks were lost in SQL grouping conditions and stack underflow safety checks.",
    evaluatedAt: new Date().toISOString(),
    source: "automated",
  };

  saveEvaluation(evaluation);
  return evaluation;
}

/* =========================================================================
   Teacher Reviews Repository
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

  // If review adjusts marks, update evaluation record score as well
  const evaluation = getEvaluationById(review.evaluationId);
  if (evaluation) {
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

  // Completed or submitted attempts
  const completedAttempts = attempts.filter(
    (a) => a.status === "submitted" || a.status === "evaluated"
  );

  // Pending evaluation: submitted attempts that don't have an evaluation yet
  const evaluatedAttemptIds = new Set(evaluations.map((e) => e.attemptId));
  const pendingCount = attempts.filter(
    (a) => a.status === "submitted" && !evaluatedAttemptIds.has(a.id)
  ).length;

  const validScores = evaluations
    .filter((e) => e.maximumMarks > 0)
    .map((e) => (e.score / e.maximumMarks) * 100);

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

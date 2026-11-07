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

/**
 * Creates a genuine pending evaluation record when an answer sheet is submitted.
 * Does NOT generate fake scores or arbitrary marks.
 * Prepares the question structure for future Gemini Vision OCR and rubric evaluation.
 */
export function createPendingEvaluation(
  attempt: StudentAttempt,
  paper: PaperRecord
): EvaluationRecord {
  const maxMarks = paper.maximumMarks ?? 70;

  // Question-wise assessment structure ready for OCR extraction and rubric evaluation
  const questions: QuestionEvaluationItem[] = [
    {
      questionId: "q1",
      number: 1,
      section: "SECTION A",
      title: "State True or False: In Python, data type of 74 is same as the data type of 74.0.",
      topic: "Python · Data Types",
      maxMarks: 1,
      extractedText: null,
      extractedFromPages: [],
      extractionConfidence: null,
      markingCriteria: [
        { step: "Identification of numeric types (int vs float)", marks: 1, description: "Correctly identifies False because 74 is int and 74.0 is float." },
      ],
      suggestedMarks: null,
      awardedMarks: null,
      evaluatorFeedback: null,
      evaluatorConfidence: null,
      status: "pending",
    },
    {
      questionId: "q2",
      number: 2,
      section: "SECTION A",
      title: "Identify the output: s = 'the Truth'; print(s.capitalize())",
      topic: "Python · String Methods",
      maxMarks: 1,
      extractedText: null,
      extractedFromPages: [],
      extractionConfidence: null,
      markingCriteria: [
        { step: "String capitalization logic", marks: 1, description: "Outputs 'The truth' with only initial letter capitalized and remainder lowercase." },
      ],
      suggestedMarks: null,
      awardedMarks: null,
      evaluatorFeedback: null,
      evaluatorConfidence: null,
      status: "pending",
    },
    {
      questionId: "q3",
      number: 3,
      section: "SECTION A",
      title: "Which of the following expressions evaluates to True? (A) 2>3 and 2<3 (B) 3>1 and 2 (C) 3>1 and 3>2 (D) 3>1 and 3<2",
      topic: "Python · Logical Operators",
      maxMarks: 1,
      extractedText: null,
      extractedFromPages: [],
      extractionConfidence: null,
      markingCriteria: [
        { step: "Boolean operator evaluation", marks: 1, description: "Option (C) evaluates both operands to True (True and True => True)." },
      ],
      suggestedMarks: null,
      awardedMarks: null,
      evaluatorFeedback: null,
      evaluatorConfidence: null,
      status: "pending",
    },
    {
      questionId: "q4",
      number: 4,
      section: "SECTION A",
      title: "What is the output: s = 'War and Peace by Leo Tolstoy'; print(s.partition('by'))",
      topic: "Python · String Partition",
      maxMarks: 1,
      extractedText: null,
      extractedFromPages: [],
      extractionConfidence: null,
      markingCriteria: [
        { step: "Tuple partitioning with separator", marks: 1, description: "Returns 3-tuple ('War and Peace ', 'by', ' Leo Tolstoy')." },
      ],
      suggestedMarks: null,
      awardedMarks: null,
      evaluatorFeedback: null,
      evaluatorConfidence: null,
      status: "pending",
    },
    {
      questionId: "q5",
      number: 5,
      section: "SECTION A",
      title: "What will be the output: print('PythonProgram'[-1:2:-2])",
      topic: "Python · Negative Slicing",
      maxMarks: 1,
      extractedText: null,
      extractedFromPages: [],
      extractionConfidence: null,
      markingCriteria: [
        { step: "Negative stride string slicing", marks: 1, description: "Reverses with step of 2 stopping before index 2 ('mroPr')." },
      ],
      suggestedMarks: null,
      awardedMarks: null,
      evaluatorFeedback: null,
      evaluatorConfidence: null,
      status: "pending",
    },
    {
      questionId: "q6",
      number: 6,
      section: "SECTION B",
      title: "Difference between mutable and immutable data types in Python with examples.",
      topic: "Python · Mutability",
      maxMarks: 2,
      extractedText: null,
      extractedFromPages: [],
      extractionConfidence: null,
      markingCriteria: [
        { step: "Concept definition", marks: 1, description: "Clear definition of in-place memory modification vs creating new objects." },
        { step: "Accurate examples", marks: 1, description: "List/dict/set as mutable; int/float/string/tuple as immutable." },
      ],
      suggestedMarks: null,
      awardedMarks: null,
      evaluatorFeedback: null,
      evaluatorConfidence: null,
      status: "pending",
    },
    {
      questionId: "q7",
      number: 7,
      section: "SECTION B",
      title: "Write an SQL query to display department name and total employees from EMP grouped by department.",
      topic: "SQL · Group By & Aggregation",
      maxMarks: 2,
      extractedText: null,
      extractedFromPages: [],
      extractionConfidence: null,
      markingCriteria: [
        { step: "SELECT department and COUNT(*)", marks: 1, description: "Correct aggregate function and projection list." },
        { step: "GROUP BY clause", marks: 1, description: "Proper GROUP BY department syntax without syntax errors." },
      ],
      suggestedMarks: null,
      awardedMarks: null,
      evaluatorFeedback: null,
      evaluatorConfidence: null,
      status: "pending",
    },
    {
      questionId: "q8",
      number: 8,
      section: "SECTION C",
      title: "Write function count_words() to read 'STORY.TXT' and count words starting with vowel letters.",
      topic: "File Handling · Text Files",
      maxMarks: 3,
      extractedText: null,
      extractedFromPages: [],
      extractionConfidence: null,
      markingCriteria: [
        { step: "File opening & safe handling", marks: 1, description: "Opens file with open() in read mode or using 'with' statement." },
        { step: "Tokenization & word iteration", marks: 1, description: "Splits file text into words and iterates through words correctly." },
        { step: "Vowel check & count tally", marks: 1, description: "Checks first character in lowercase/uppercase vowels and returns/prints count." },
      ],
      suggestedMarks: null,
      awardedMarks: null,
      evaluatorFeedback: null,
      evaluatorConfidence: null,
      status: "pending",
    },
    {
      questionId: "q9",
      number: 9,
      section: "SECTION C",
      title: "School campus with 4 blocks: suggest suitable cable layout and topology with minimum wire length.",
      topic: "Networking · Case Study",
      maxMarks: 3,
      extractedText: null,
      extractedFromPages: [],
      extractionConfidence: null,
      markingCriteria: [
        { step: "Network topology recommendation", marks: 1, description: "Recommends star or bus topology with valid technical reasoning." },
        { step: "Cable layout diagram / distance calculation", marks: 1, description: "Demonstrates minimum spanning tree or direct block connections based on distance." },
        { step: "Switch / server placement justification", marks: 1, description: "Places server in block with maximum computers to reduce network latency." },
      ],
      suggestedMarks: null,
      awardedMarks: null,
      evaluatorFeedback: null,
      evaluatorConfidence: null,
      status: "pending",
    },
    {
      questionId: "q10",
      number: 10,
      section: "SECTION D",
      title: "Write Push and Pop stack functions containing Book details [BookNo, BookName]. Handle underflow.",
      topic: "Data Structures · Stack Implementation",
      maxMarks: 5,
      extractedText: null,
      extractedFromPages: [],
      extractionConfidence: null,
      markingCriteria: [
        { step: "Push function logic", marks: 2, description: "Accepts stack and book record, appends item onto list." },
        { step: "Stack underflow condition check", marks: 1, description: "Checks if len(stack) == 0 before pop." },
        { step: "Pop operation & return value", marks: 2, description: "Pops element using .pop() and displays or returns removed book." },
      ],
      suggestedMarks: null,
      awardedMarks: null,
      evaluatorFeedback: null,
      evaluatorConfidence: null,
      status: "pending",
    },
  ];

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

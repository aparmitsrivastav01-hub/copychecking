export type PaperKind = "question_paper" | "textbook" | "textbook_chapter" | "study_material" | "other";
export type PaperFormat = "pdf" | "doc" | "docx" | "image" | "text" | "other";

export interface PaperMetadata {
  title: string | null;
  author: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface PaperRecord {
  id: string;
  title: string;
  filename: string;
  relativePath: string;
  sourcePath?: string;
  format: PaperFormat;
  mimeType: string;
  kind: PaperKind;
  subject: string | null;
  grade: number | null;
  paperType: string | null;
  year: number | null;
  academicSession: string | null;
  maximumMarks: number | null;
  durationMinutes: number | null;
  pageCount: number | null;
  sizeBytes?: number;
  previewText: string | null;
  readWarnings?: string[];
  metadata: PaperMetadata;
  indexedAt: string;
}

// Student Attempt & Submission Status
export type SubmissionStatus = "in_progress" | "submitted" | "awaiting_evaluation" | "evaluated";

export interface AnswerPage {
  pageNumber: number;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt: string;
}

export interface StudentAttempt {
  id: string;
  paperId: string;
  startedAt: string;
  submittedAt: string | null;
  status: SubmissionStatus;
  answerFiles: string[];
  answerPages: AnswerPage[];
  notes: Record<string, string>;
  remainingSeconds?: number;
}

// Question-wise Evaluation & OCR Extraction Models
export type EvaluationStatus = "pending" | "extracting" | "assessing" | "completed" | "failed";

export interface StepwiseCriterion {
  step: string;
  marks: number;
  description: string;
}

export interface QuestionEvaluationItem {
  questionId: string;
  number: number;
  section: string;
  title: string;
  topic: string;
  maxMarks: number;

  // OCR Answer Extraction (Prepared for Gemini Vision)
  extractedText: string | null;
  extractedFromPages: number[];
  extractionConfidence: number | null;

  // Stepwise Assessment & Scoring
  markingCriteria: StepwiseCriterion[];
  suggestedMarks: number | null;
  awardedMarks: number | null;
  evaluatorFeedback: string | null;
  evaluatorConfidence: number | null;
  status: "pending" | "evaluated" | "needs_review";

  // Detailed Rubric & Evaluation Breakdown
  expectedAnswer?: string;
  deductionReasons?: string[];
  improvementSuggestions?: string[];
  needsHumanReview?: boolean;
  reviewFlags?: string[];
  stepAssessments?: {
    step: string;
    maxMarks: number;
    awardedMarks: number;
    met: boolean;
    feedback: string;
  }[];
}

export interface EvaluationRecord {
  id: string;
  attemptId: string;
  paperId: string;
  status: EvaluationStatus;
  score: number | null;
  maximumMarks: number;
  percentage: number | null;
  summary: string | null;
  questions: QuestionEvaluationItem[];
  submittedAt: string;
  evaluatedAt: string | null;
  evaluatorId?: string | null;
  source: "pending" | "gemini_vision" | "teacher" | "hybrid";
  sectionScores?: Record<string, { scored: number; total: number; percentage: number }>;
  reviewAlerts?: string[];
}

export interface TeacherReview {
  id: string;
  evaluationId: string;
  attemptId: string;
  teacherId: string | null;
  adjustments: Record<string, number>;
  note: string;
  updatedAt: string;
}

export interface DashboardStatistics {
  attempts: number;
  averageScorePercent: number;
  pendingEvaluations: number;
  personalBestPercent: number;
}

export interface UnreadableFile {
  path: string;
  reason: string;
}

export interface PaperManifest {
  generatedAt: string;
  sourceDirectory: string;
  indexedCount?: number;
  questionPaperCount?: number;
  warningCount?: number;
  unreadableCount?: number;
  papers: PaperRecord[];
  unreadableFiles: UnreadableFile[];
}

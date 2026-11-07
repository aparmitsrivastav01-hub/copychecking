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

export type AttemptStatus = "in_progress" | "submitted" | "evaluated";

export interface StudentAttempt {
  id: string;
  paperId: string;
  startedAt: string;
  submittedAt: string | null;
  status: AttemptStatus;
  answerFiles: string[];
  notes: Record<string, string>;
  remainingSeconds?: number;
}

export interface QuestionMark {
  questionId: string;
  number: number;
  title: string;
  topic: string;
  scored: number;
  total: number;
  status: "strong" | "partial" | "review";
  feedback: string;
}

export interface EvaluationRecord {
  id: string;
  attemptId: string;
  paperId: string;
  score: number;
  maximumMarks: number;
  percentage: number;
  questions: QuestionMark[];
  summary: string;
  evaluatedAt: string;
  source: "teacher" | "automated";
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

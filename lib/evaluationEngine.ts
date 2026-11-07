import type {
  AnswerPage,
  EvaluationRecord,
  PaperRecord,
  QuestionEvaluationItem,
  StudentAttempt,
} from "@/lib/models";

/**
 * Architecture and interfaces for real answer-sheet evaluation.
 * Prepared for Gemini Vision / multimodal OCR and stepwise CBSE evaluation.
 */

export interface VisionExtractionRequest {
  attemptId: string;
  paperId: string;
  pages: AnswerPage[];
  targetLanguage?: string;
}

export interface ExtractedAnswerSegment {
  questionNumber: number;
  subPart?: string;
  pageNumber: number;
  rawText: string;
  confidence: number;
  isCodeSegment: boolean;
  detectedTopic?: string;
}

export interface StepAssessment {
  step: string;
  maxMarks: number;
  awardedMarks: number;
  rationale: string;
}

export interface QuestionAssessment {
  questionId: string;
  questionNumber: number;
  extractedText: string;
  extractedFromPages: number[];
  extractionConfidence: number;
  stepBreakdown: StepAssessment[];
  totalSuggestedMarks: number;
  maxMarks: number;
  evaluatorFeedback: string;
  evaluatorConfidence: number;
  needsHumanReview: boolean;
}

export interface GeminiVisionEvaluationPipeline {
  /**
   * Phase 1: OCR & Layout Analysis
   * Submits page images/PDF to Gemini Vision to detect student handwriting,
   * questions answered, line-by-line Python code, SQL clauses, and network diagrams.
   */
  extractHandwrittenAnswers(
    request: VisionExtractionRequest
  ): Promise<ExtractedAnswerSegment[]>;

  /**
   * Phase 2: CBSE Stepwise Rubric Application
   * Compares extracted answers with official CBSE marking scheme for Class 12 Computer Science.
   */
  assessAnswersAgainstRubric(
    paper: PaperRecord,
    extracted: ExtractedAnswerSegment[]
  ): Promise<QuestionAssessment[]>;

  /**
   * Phase 3: Evaluation Finalization
   * Combines extraction and assessment into an EvaluationRecord with status completed.
   */
  processCompleteEvaluation(
    attempt: StudentAttempt,
    paper: PaperRecord
  ): Promise<EvaluationRecord>;
}

/**
 * Placeholder pipeline demonstrating the contract and pipeline state
 * without generating arbitrary or fake scores before real Gemini Vision integration.
 */
export class PendingEvaluationEngine implements GeminiVisionEvaluationPipeline {
  async extractHandwrittenAnswers(
    _request: VisionExtractionRequest
  ): Promise<ExtractedAnswerSegment[]> {
    // Requires active Gemini API key and backend OCR worker.
    throw new Error(
      "Backend OCR integration required: Connect Gemini 2.5 Flash Vision API to extract handwritten pages."
    );
  }

  async assessAnswersAgainstRubric(
    _paper: PaperRecord,
    _extracted: ExtractedAnswerSegment[]
  ): Promise<QuestionAssessment[]> {
    // Requires backend LLM evaluation runner.
    throw new Error(
      "Backend Assessment integration required: Connect CBSE marking rubric runner."
    );
  }

  async processCompleteEvaluation(
    attempt: StudentAttempt,
    paper: PaperRecord
  ): Promise<EvaluationRecord> {
    // Returns a genuine pending record without arbitrary scores
    const { createPendingEvaluation } = await import(
      "@/lib/repositories/localRepository"
    );
    return createPendingEvaluation(attempt, paper);
  }
}

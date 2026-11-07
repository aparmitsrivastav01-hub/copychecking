import rubricJson from '@/data/papercheck_cbse_2025_cs083_set4_qp91_full_rubric.json';

export interface RubricStep {
  step: string;
  marks: number;
  description: string;
}

export interface QuestionRubric {
  questionNumber: number;
  section: string;
  maxMarks: number;
  topic: string;
  type: string;
  questionText: string;
  modelAnswer: string;
  acceptedAlternatives: string[];
  criteria: RubricStep[];
  explanation: string;
  reviewFlags?: {
    allowSemanticMatch?: boolean;
    checkCodeSyntax?: boolean;
    checkSqlLogic?: boolean;
    requiresHumanReview?: boolean;
  };
}

export interface RubricSection {
  section: string;
  name: string;
  questionCount: number;
  marksPerQuestion: number;
  totalMarks: number;
  description: string;
}

export interface PaperRubric {
  paperId: string;
  title: string;
  subject: string;
  subjectCode: string;
  academicSession: string;
  year: number;
  set: number;
  qpCode: string;
  maximumMarks: number;
  durationMinutes: number;
  totalQuestions: number;
  sections: RubricSection[];
  questions: QuestionRubric[];
}

const bundledRubric = rubricJson as unknown as PaperRubric;

/**
 * Loads the authentic CBSE Class 12 CS 083 (2025) Set 4 QP 91 rubric dynamically.
 */
export async function loadRubric(_paperId?: string): Promise<PaperRubric> {
  // Validate integrity
  if (!bundledRubric.questions || bundledRubric.questions.length !== 37) {
    throw new Error(`Rubric corrupted: Expected 37 questions, found ${bundledRubric.questions?.length ?? 0}`);
  }

  const totalCalculated = bundledRubric.questions.reduce((sum, q) => sum + q.maxMarks, 0);
  if (totalCalculated !== 70) {
    throw new Error(`Rubric corrupted: Total marks sum to ${totalCalculated}, expected 70`);
  }

  return bundledRubric;
}

export function getBundledRubric(): PaperRubric {
  return bundledRubric;
}

export async function getQuestionRubric(questionNumber: number, paperId?: string): Promise<QuestionRubric | null> {
  const rubric = await loadRubric(paperId);
  return rubric.questions.find((q) => q.questionNumber === questionNumber) || null;
}

export async function getRubricSections(paperId?: string): Promise<RubricSection[]> {
  const rubric = await loadRubric(paperId);
  return rubric.sections;
}

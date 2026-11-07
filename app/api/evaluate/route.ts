import { NextRequest, NextResponse } from 'next/server';
import { runFullEvaluation, type StudentAnswerSubmission } from '@/lib/services/evaluator';
import { loadRubric } from '@/lib/services/rubricService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const paperId = searchParams.get('paperId') || 'cbse_2025_cs083_set4_qp91';
    const rubric = await loadRubric(paperId);

    return NextResponse.json({
      success: true,
      rubric: {
        paperId: rubric.paperId,
        title: rubric.title,
        totalQuestions: rubric.totalQuestions,
        maximumMarks: rubric.maximumMarks,
        sections: rubric.sections,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load rubric' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const { attemptId, paperId, answers, submittedAt } = body;

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: attemptId' },
        { status: 400 }
      );
    }

    const targetPaperId = paperId || 'cbse_2025_cs083_set4_qp91';
    const formattedAnswers: StudentAnswerSubmission[] = Array.isArray(answers) ? answers : [];

    // Run evaluation against authentic CBSE Class 12 CS rubric
    const evaluationRecord = await runFullEvaluation({
      attemptId,
      paperId: targetPaperId,
      submittedAt: submittedAt || new Date().toISOString(),
      answers: formattedAnswers,
    });

    return NextResponse.json({
      success: true,
      evaluation: evaluationRecord,
    });
  } catch (err: any) {
    console.error('Error evaluating attempt:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal evaluation engine error',
      },
      { status: 500 }
    );
  }
}

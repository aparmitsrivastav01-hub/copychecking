import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, hasPermission } from "@/lib/services/authService";
import {
  getEvaluationById,
  approveEvaluation,
  modifyQuestionEvaluation,
  saveDraftReview,
  rejectEvaluation,
} from "@/lib/services/reviewService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = getUserFromRequest(req);
    const evaluation = getEvaluationById(id);

    if (!evaluation) {
      return NextResponse.json(
        { success: false, error: "Evaluation record not found" },
        { status: 404 }
      );
    }

    const isStaff = user && hasPermission(user, ["examiner", "admin"]);

    // If user is not staff, verify approval gate
    if (!isStaff) {
      if (evaluation.approvalStatus !== "approved") {
        return NextResponse.json(
          {
            success: false,
            pendingApproval: true,
            status: evaluation.approvalStatus || "pending_review",
            message:
              "This evaluation is currently undergoing verification by Head Examiner Nitin Paliwal. Scores and marking breakdowns will be visible once approved.",
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (err: any) {
    console.error("Error retrieving evaluation:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to retrieve evaluation" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = getUserFromRequest(req);

    if (!user || !hasPermission(user, ["examiner", "admin"])) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Examiner privileges required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const action = body.action;
    const examinerName = user.name || "Nitin Paliwal";

    let result = null;

    if (action === "approve") {
      result = approveEvaluation(id, examinerName, body.examinerNotes);
    } else if (action === "modify_question") {
      if (!body.questionId) {
        return NextResponse.json(
          { success: false, error: "Missing questionId for modification" },
          { status: 400 }
        );
      }
      result = modifyQuestionEvaluation(
        id,
        body.questionId,
        {
          marks: body.marks,
          feedback: body.feedback,
          reason: body.reason,
          flagged: body.flagged,
        },
        examinerName
      );
    } else if (action === "save_draft") {
      result = saveDraftReview(id, body.examinerNotes, examinerName);
    } else if (action === "reject") {
      if (!body.reason) {
        return NextResponse.json(
          { success: false, error: "Rejection reason is required" },
          { status: 400 }
        );
      }
      result = rejectEvaluation(id, body.reason, examinerName);
    } else {
      return NextResponse.json(
        { success: false, error: `Unsupported review action: ${action}` },
        { status: 400 }
      );
    }

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Evaluation not found or operation failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      evaluation: result,
    });
  } catch (err: any) {
    console.error("Error executing review action:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Operation failed" },
      { status: 500 }
    );
  }
}

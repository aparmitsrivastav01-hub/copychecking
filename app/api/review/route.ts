import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, hasPermission } from "@/lib/services/authService";
import { getAllEvaluations, getEvaluationMetrics, saveEvaluationRecord } from "@/lib/services/reviewService";

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user || !hasPermission(user, ["examiner", "admin"])) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Examiner or administrator privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    const evaluations = getAllEvaluations({ status, search });
    const metrics = getEvaluationMetrics();

    return NextResponse.json({
      success: true,
      metrics,
      evaluations,
    });
  } catch (err: any) {
    console.error("Error fetching review queue:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user || !hasPermission(user, ["examiner", "admin"])) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Examiner privileges required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (!body || !body.id) {
      return NextResponse.json(
        { success: false, error: "Invalid evaluation payload" },
        { status: 400 }
      );
    }

    const saved = saveEvaluationRecord(body);
    return NextResponse.json({
      success: true,
      evaluation: saved,
    });
  } catch (err: any) {
    console.error("Error creating/saving evaluation in review store:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

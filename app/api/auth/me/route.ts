import { NextRequest, NextResponse } from "next/server";
import { getSession, SESSION_COOKIE_NAME } from "@/lib/services/authService";

export async function GET(req: NextRequest) {
  const token =
    req.cookies.get(SESSION_COOKIE_NAME)?.value ||
    req.headers.get("Authorization")?.replace("Bearer ", "");

  const session = getSession(token);
  if (!session) {
    return NextResponse.json(
      { success: false, authenticated: false, user: null },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    user: session.user,
  });
}

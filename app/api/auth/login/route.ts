import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  findUserByEmail,
  verifyCredentials,
  SESSION_COOKIE_NAME,
} from "@/lib/services/authService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, demoRole } = body;

    let user = null;

    if (demoRole) {
      // Instant demo login for reviewer or student
      if (demoRole === "examiner") {
        user = findUserByEmail("nitin@codebrahmastra.com");
      } else if (demoRole === "student") {
        user = findUserByEmail("aarav@papercheck.ai");
      } else if (demoRole === "admin") {
        user = findUserByEmail("admin@papercheck.ai");
      }
    } else {
      if (!email || !password) {
        return NextResponse.json(
          { success: false, error: "Email and password are required" },
          { status: 400 }
        );
      }
      user = verifyCredentials(email, password);
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const session = createSession(user);

    const response = NextResponse.json({
      success: true,
      user,
      token: session.token,
    });

    // Set cookie
    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: false, // Accessible to client-side auth helpers
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Login failed" },
      { status: 500 }
    );
  }
}

"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "";
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(targetEmail?: string, targetPassword?: string) {
    const submitEmail = targetEmail ?? email;
    const submitPassword = targetPassword ?? password;

    if (!submitEmail || !submitPassword) {
      setError("Please provide both email and password.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await login(submitEmail, submitPassword);
      if (res.success) {
        // Direct based on role or redirect param
        if (redirectUrl) {
          router.push(redirectUrl);
        } else if (submitEmail.includes("nitin") || submitEmail.includes("examiner") || submitEmail.includes("admin")) {
          router.push("/review");
        } else {
          router.push("/dashboard");
        }
      } else {
        setError(res.error || "Authentication failed. Check your credentials.");
      }
    } catch (e: any) {
      setError(e?.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a09] text-[#e8e6df] flex flex-col justify-between selection:bg-[#e7b72e]/30 selection:text-[#e7b72e]">
      {/* Top Header */}
      <header className="border-b border-[#26241e] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e7b72e] to-[#c79818] flex items-center justify-center font-bold text-black text-sm shadow-[0_0_15px_rgba(231,183,46,0.25)]">
            PC
          </div>
          <div>
            <span className="font-semibold tracking-wide text-white">PaperCheck AI</span>
            <span className="text-xs text-[#a09b8f] ml-2 font-mono">v3.2 Secure Auth</span>
          </div>
        </Link>
        <Link
          href="/dashboard"
          className="text-xs text-[#a09b8f] hover:text-[#e7b72e] transition font-mono"
        >
          &larr; Return to Dashboard
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b1a15] border border-[#343026] text-xs font-mono text-[#e7b72e] mb-4">
            <span className="w-2 h-2 rounded-full bg-[#e7b72e] animate-pulse"></span>
            Role-Based Access Control
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Sign In to PaperCheck AI
          </h1>
          <p className="text-sm text-[#a09b8f]">
            Access the CBSE examination engine or evaluator dashboard.
          </p>
        </div>

        {/* Quick Demo Switchers */}
        <div className="mb-6 bg-[#121210] border border-[#26241e] rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-[#a09b8f] font-mono mb-3 font-semibold">
            Quick 1-Click Demo Profiles
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleLogin("nitin@codebrahmastra.com", "examiner123")}
              disabled={submitting}
              className="w-full text-left p-2.5 rounded-lg border border-[#343026] bg-[#171612] hover:bg-[#1f1d17] hover:border-[#e7b72e]/50 transition flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>Nitin Paliwal</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#e7b72e]/20 text-[#e7b72e] border border-[#e7b72e]/30">
                    HEAD EXAMINER
                  </span>
                </div>
                <div className="text-[11px] text-[#a09b8f]">
                  Evaluator workspace, mark overrides &amp; score publishing
                </div>
              </div>
              <span className="text-[#e7b72e] text-xs font-mono group-hover:translate-x-0.5 transition">
                &rarr;
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleLogin("aarav@papercheck.ai", "student123")}
              disabled={submitting}
              className="w-full text-left p-2.5 rounded-lg border border-[#343026] bg-[#171612] hover:bg-[#1f1d17] hover:border-[#3b82f6]/50 transition flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>Aarav Gupta</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    STUDENT
                  </span>
                </div>
                <div className="text-[11px] text-[#a09b8f]">
                  Exam room, paper catalogue, answer upload &amp; approved reports
                </div>
              </div>
              <span className="text-blue-400 text-xs font-mono group-hover:translate-x-0.5 transition">
                &rarr;
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleLogin("admin@papercheck.ai", "admin123")}
              disabled={submitting}
              className="w-full text-left p-2.5 rounded-lg border border-[#343026] bg-[#171612] hover:bg-[#1f1d17] hover:border-purple-500/50 transition flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>System Admin</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    ADMIN
                  </span>
                </div>
                <div className="text-[11px] text-[#a09b8f]">
                  Audit oversight, system configuration &amp; queue supervision
                </div>
              </div>
              <span className="text-purple-400 text-xs font-mono group-hover:translate-x-0.5 transition">
                &rarr;
              </span>
            </button>
          </div>
        </div>

        {/* Traditional Credentials Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
          className="bg-[#121210] border border-[#26241e] rounded-xl p-6 shadow-xl space-y-4"
        >
          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-[#a09b8f] mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. nitin@codebrahmastra.com"
              required
              className="w-full bg-[#171612] border border-[#343026] rounded-lg px-3 py-2 text-sm text-white placeholder-[#5a574e] focus:outline-none focus:border-[#e7b72e] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-[#a09b8f] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-[#171612] border border-[#343026] rounded-lg px-3 py-2 text-sm text-white placeholder-[#5a574e] focus:outline-none focus:border-[#e7b72e] transition"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-[#e7b72e] to-[#c79818] text-black font-semibold text-sm hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 shadow-[0_0_15px_rgba(231,183,46,0.2)]"
          >
            {submitting ? "Authenticating..." : "Sign In with Credentials"}
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#26241e] px-6 py-4 text-center text-xs text-[#6e6a5e] font-mono">
        PaperCheck AI &bull; Head Evaluator Nitin Paliwal &bull; CBSE Class 12 CS (083) Examination Engine
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a09] flex items-center justify-center text-[#e7b72e] font-mono text-xs">
          Loading authentication portal...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

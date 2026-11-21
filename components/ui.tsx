"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileCheck2,
  Sparkles,
  Target,
  Upload,
  User,
  Zap,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="PaperCheck AI home">
      <span className="brand-mark">
        <FileCheck2 size={17} strokeWidth={2.4} />
      </span>
      <span className="brand-name">
        PaperCheck <i>AI</i>
        {!compact && <small>BY NITIN PALIWAL</small>}
      </span>
    </Link>
  );
}

export function TopNav({ active = "" }: { active?: string }) {
  const { user, isExaminer, switchUser, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="top-nav">
      <div className="nav-inner">
        <Brand />
        <nav className="nav-links" aria-label="Main navigation">
          <Link className={active === "papers" ? "active" : ""} href="/test">
            Papers
          </Link>
          <a href="/#how-it-works">How it works</a>
          <a href="/#features">Features</a>
          <Link href="/dashboard" className={active === "dashboard" ? "active" : ""}>
            Dashboard
          </Link>
          {isExaminer && (
            <Link
              href="/review"
              className="text-[#e7b72e] font-semibold flex items-center gap-1 bg-[#1a170e] px-2.5 py-1 rounded-md border border-[#e7b72e]/30"
            >
              <span>⚖</span>
              <span>Examiner Review</span>
            </Link>
          )}
        </nav>

        <div className="nav-actions relative">
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#141411] border border-[#26241e] hover:border-[#e7b72e]/50 text-xs font-mono transition"
              >
                <span className="w-5 h-5 rounded-full bg-[#e7b72e] text-black font-bold flex items-center justify-center text-[10px]">
                  {user.name.charAt(0)}
                </span>
                <span className="text-white hidden sm:inline">{user.name.split(" ")[0]}</span>
                <span className="text-[10px] text-[#e7b72e] uppercase">
                  {user.role === "examiner" ? "EXAMINER" : user.role === "admin" ? "ADMIN" : "STUDENT"}
                </span>
                <ChevronDown size={12} className="text-[#a09b8f]" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#141411] border border-[#2b2923] rounded-xl shadow-2xl p-2 z-50 text-xs font-mono">
                  <div className="px-3 py-2 border-b border-[#21201a] mb-1">
                    <div className="text-white font-semibold">{user.name}</div>
                    <div className="text-[11px] text-[#a09b8f]">{user.email}</div>
                  </div>

                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-1.5 rounded hover:bg-[#1f1e19] text-[#e8e6df]"
                  >
                    Student Dashboard
                  </Link>
                  <Link
                    href="/review"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-1.5 rounded hover:bg-[#1f1e19] text-[#e7b72e]"
                  >
                    Examiner Review Portal
                  </Link>

                  <div className="border-t border-[#21201a] my-1 pt-1">
                    <div className="px-3 py-1 text-[10px] text-[#716e64] uppercase">Quick Switch</div>
                    <button
                      type="button"
                      onClick={() => {
                        switchUser("examiner");
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1 rounded hover:bg-[#1f1e19] text-[#e7b72e] text-[11px]"
                    >
                      &bull; Nitin Paliwal (Examiner)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        switchUser("student");
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1 rounded hover:bg-[#1f1e19] text-blue-400 text-[11px]"
                    >
                      &bull; Aarav Gupta (Student)
                    </button>
                  </div>

                  <div className="border-t border-[#21201a] my-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded hover:bg-red-950/40 text-red-400 text-xs"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link className="nav-login" href="/login">
                Log in
              </Link>
              <Link className="button button-gold button-small" href="/dashboard">
                Start for free <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>
        <Link href="/dashboard" className="mobile-nav-cta">
          Open app <ArrowRight size={14} />
        </Link>
      </div>
    </header>
  );
}

export function AppNav({ active }: { active: string }) {
  const { user, isExaminer, switchUser, logout } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const items = [
    { href: "/dashboard", label: "Overview" },
    { href: "/test", label: "Catalogue" },
    { href: "/exam", label: "Exam Room" },
    { href: "/upload", label: "My Answers" },
    { href: "/report", label: "Results" },
  ];

  if (isExaminer) {
    items.push({ href: "/review", label: "⚖ Examiner Review" });
  }

  const displayName = user?.name || "Nitin Paliwal";
  const userInitial = displayName.charAt(0);
  const isExaminerRole = isExaminer || user?.role === "examiner" || user?.role === "admin";

  return (
    <header className="app-nav">
      <div className="app-nav-top">
        <Brand compact />

        <div className="relative">
          <button
            type="button"
            onClick={() => setSwitcherOpen(!switcherOpen)}
            className="student-pill cursor-pointer hover:border-[#e7b72e]/50 transition"
          >
            <span className="avatar bg-[#e7b72e] text-black font-bold">
              {userInitial}
            </span>
            <span className="font-semibold">{displayName}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#26241e] text-[#e7b72e]">
              {isExaminerRole ? "EXAMINER" : "STUDENT"}
            </span>
            <ChevronDown size={14} className="text-[#a09b8f]" />
          </button>

          {switcherOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[#141411] border border-[#2b2923] rounded-xl shadow-2xl p-3 z-50 text-xs font-mono">
              <div className="pb-2 border-b border-[#21201a] mb-2">
                <div className="text-white font-semibold">{displayName}</div>
                <div className="text-[11px] text-[#a09b8f]">{user?.email || "Active User"}</div>
              </div>

              <div className="text-[10px] text-[#716e64] uppercase mb-1">Switch Role / Demo</div>
              <button
                type="button"
                onClick={() => {
                  switchUser("examiner");
                  setSwitcherOpen(false);
                }}
                className="w-full text-left p-2 rounded-lg bg-[#181713] hover:bg-[#222019] border border-[#26241e] text-[#e7b72e] mb-1.5 transition flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-white">Nitin Paliwal</div>
                  <div className="text-[10px] text-[#a09b8f]">Head Examiner Workspace</div>
                </div>
                <span>&rarr;</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  switchUser("student");
                  setSwitcherOpen(false);
                }}
                className="w-full text-left p-2 rounded-lg bg-[#181713] hover:bg-[#222019] border border-[#26241e] text-blue-400 mb-2 transition flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-white">Aarav Gupta</div>
                  <div className="text-[10px] text-[#a09b8f]">CBSE Class 12 CS Student</div>
                </div>
                <span>&rarr;</span>
              </button>

              <div className="border-t border-[#21201a] pt-2">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setSwitcherOpen(false);
                  }}
                  className="w-full text-left px-2 py-1 rounded text-red-400 hover:bg-red-950/30 text-xs"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="app-tabs">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={active === item.href ? "selected" : ""}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "gold",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "gold" | "outline" | "text";
  className?: string;
}) {
  return (
    <Link href={href} className={`button button-${variant} ${className}`}>
      {children}
    </Link>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <div className="eyebrow">
          <span /> {eyebrow}
        </div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="intro-action">{action}</div>}
    </div>
  );
}

export function SectionLabel({
  children,
  number,
}: {
  children: ReactNode;
  number?: string;
}) {
  return (
    <div className="section-label">
      <span className="section-dot" />
      {number && <span className="section-number">{number}</span>}
      {children}
      <ArrowDownRight size={14} />
    </div>
  );
}

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export function StatCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: ReactNode;
}) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="stat-note">{note}</span>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <Brand />
        <span>Built for the work behind the marks.</span>
        <a href="mailto:hello@papercheck.ai">
          Say hello <ArrowUpRight size={14} />
        </a>
      </div>
      <div className="footer-bottom">
        <span>&copy; 2026 PaperCheck AI &bull; Nitin Paliwal</span>
        <span>CBSE Class 12 Computer Science (083) Examination Engine</span>
      </div>
    </footer>
  );
}

export const featureIcons = {
  book: BookOpen,
  target: Target,
  sparkles: Sparkles,
  upload: Upload,
  clock: Clock3,
  zap: Zap,
  check: Check,
};

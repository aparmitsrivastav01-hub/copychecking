"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Clock3, FileCheck2, Sparkles, Target, Upload, Zap } from "lucide-react";
import type { ReactNode } from "react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="brand" aria-label="PaperCheck AI home"><span className="brand-mark"><FileCheck2 size={17} strokeWidth={2.4}/></span><span className="brand-name">PaperCheck <i>AI</i>{!compact && <small>BY NITIN PALIWAL</small>}</span></Link>;
}

export function TopNav({ active = "" }: { active?: string }) {
  return <header className="top-nav"><div className="nav-inner"><Brand/><nav className="nav-links" aria-label="Main navigation"><Link className={active === "papers" ? "active" : ""} href="/test">Papers</Link><a href="/#how-it-works">How it works</a><a href="/#features">Features</a><Link href="/dashboard">For students</Link></nav><div className="nav-actions"><Link className="nav-login" href="/dashboard">Log in</Link><Link className="button button-gold button-small" href="/dashboard">Start for free <ArrowRight size={14}/></Link></div><Link href="/dashboard" className="mobile-nav-cta">Open app <ArrowRight size={14}/></Link></div></header>;
}

export function AppNav({ active }: { active: string }) {
  const items = [{ href: "/dashboard", label: "Overview" }, { href: "/test", label: "Take a test" }, { href: "/upload", label: "My answers" }, { href: "/report", label: "Results" }];
  return <header className="app-nav"><div className="app-nav-top"><Brand compact/><div className="student-pill"><span className="avatar">N</span><span>Nitin&apos;s workspace</span><ChevronRight size={14}/></div></div><nav className="app-tabs">{items.map((item) => <Link key={item.href} href={item.href} className={active === item.href ? "selected" : ""}>{item.label}</Link>)}</nav></header>;
}

export function ButtonLink({ href, children, variant = "gold", className = "" }: { href: string; children: ReactNode; variant?: "gold" | "outline" | "text"; className?: string }) {
  return <Link href={href} className={`button button-${variant} ${className}`}>{children}</Link>;
}

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow"><span/> {eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="intro-action">{action}</div>}</div>;
}

export function SectionLabel({ children, number }: { children: ReactNode; number?: string }) {
  return <div className="section-label"><span className="section-dot"/>{number && <span className="section-number">{number}</span>}{children}<ArrowDownRight size={14}/></div>;
}

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <motion.div className={className} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: .55, ease: [.22, 1, .36, 1], delay }}>{children}</motion.div>;
}

export function StatCard({ label, value, note, icon }: { label: string; value: string | number; note: string; icon: ReactNode }) {
  return <div className="stat-card"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><strong>{value}</strong><span className="stat-note">{note}</span></div>;
}

export function Footer() {
  return <footer className="site-footer"><div className="footer-top"><Brand/><span>Built for the work behind the marks.</span><a href="mailto:hello@papercheck.ai">Say hello <ArrowUpRight size={14}/></a></div><div className="footer-bottom"><span>© 2026 PaperCheck AI · Nitin Paliwal</span><span>Made for the next 1%.</span></div></footer>;
}

export const featureIcons = { book: BookOpen, target: Target, sparkles: Sparkles, upload: Upload, clock: Clock3, zap: Zap, check: Check };

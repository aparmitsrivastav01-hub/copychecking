"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Award, BookOpen, Clock3, FileCheck2, MoreHorizontal, Plus, TrendingUp } from "lucide-react";
import { AppNav, ButtonLink, StatCard } from "@/components/ui";
import { listPapers } from "@/lib/repositories/paperRepository";
import { getDashboardStatistics, listAttempts } from "@/lib/repositories/localRepository";
import { listTestPapers } from "@/lib/repositories/localRepository";
import type { DashboardStatistics, PaperManifest, StudentAttempt } from "@/lib/models";

const zeroStats: DashboardStatistics = { attempts: 0, averageScorePercent: 0, pendingEvaluations: 0, personalBestPercent: 0 };
const formatDate = (date: string) => new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function DashboardPage() {
  const [stats, setStats] = useState(zeroStats);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [manifest, setManifest] = useState<PaperManifest | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    setStats(getDashboardStatistics()); setAttempts(listAttempts());
    listPapers().then(setManifest).catch(() => setLoadError("Paper catalogue is not available. Rebuild the local paper index."));
  }, []);
  const testCount = manifest ? listTestPapers(manifest.papers).length : 0;
  const resourcePapers = manifest?.papers.slice(0, 3) ?? [];

  return <main className="app-frame"><AppNav active="/dashboard"/><div className="app-content">
    <div className="dashboard-welcome"><div><div className="eyebrow"><span/> CBSE CLASS 12 · COMPUTER SCIENCE</div><h1>YOUR CS WORKSPACE<span>.</span></h1><p>Your practice, papers, and evaluation records in one place.</p></div><ButtonLink href="/test">Browse papers <ArrowRight size={15}/></ButtonLink></div>
    <div className="stats-grid"><StatCard label="PAPERS ATTEMPTED" value={stats.attempts} note={stats.attempts ? "From saved test submissions" : "No submitted attempts yet"} icon={<FileCheck2 size={17}/>}/><StatCard label="AVERAGE SCORE" value={`${stats.averageScorePercent}%`} note={stats.averageScorePercent ? "From evaluated attempts" : "No evaluated attempts yet"} icon={<TrendingUp size={17}/>}/><StatCard label="PENDING EVALUATION" value={stats.pendingEvaluations} note={stats.pendingEvaluations ? "Awaiting a recorded evaluation" : "Nothing waiting for review"} icon={<Clock3 size={17}/>}/><StatCard label="PERSONAL BEST" value={`${stats.personalBestPercent}%`} note={stats.personalBestPercent ? "Best recorded evaluation" : "No score recorded yet"} icon={<Award size={17}/>}/></div>
    <div className="dashboard-columns"><section className="dashboard-panel papers-panel"><div className="panel-heading"><div><div className="eyebrow"><span/> INDEXED COMPUTER SCIENCE MATERIAL</div><h2>{manifest?.papers.length ?? 0} FILES FOUND.</h2></div><Link href="/test" className="inline-link">Catalogue <ArrowUpRight size={14}/></Link></div>
      {loadError && <p className="empty-note">{loadError}</p>}
      {!loadError && manifest && resourcePapers.length === 0 && <div className="resource-empty"><BookOpen size={20}/><b>No study materials indexed yet.</b><span>Run the paper indexing command to scan your source folder.</span></div>}
      <div className="paper-list">{resourcePapers.map((paper, index) => <article className="paper-list-item" key={paper.id}><div className={`subject-icon subject-${index}`}>{paper.kind === "question_paper" ? "QP" : paper.format.toUpperCase()}</div><div className="paper-list-main"><span>{paper.paperType ?? "Computer Science material"}<i> · {paper.format.toUpperCase()}</i></span><strong>{paper.title}</strong><small>{paper.year ?? "Year unknown"} <span>·</span> {paper.maximumMarks === null ? "Marks unknown" : `${paper.maximumMarks} marks`} <span>·</span> {paper.durationMinutes === null ? "Duration unknown" : `${paper.durationMinutes} min`}</small></div><Link href={`/test?paper=${encodeURIComponent(paper.id)}`} className="list-arrow" aria-label={`View ${paper.title}`}><ArrowRight size={15}/></Link></article>)}</div>
      {manifest && resourcePapers.length > 0 && <Link href="/test" className="paper-browse"><Plus size={14}/> Browse all {manifest.papers.length} indexed files</Link>}
      </section>
    <section className="dashboard-panel progress-panel"><div className="panel-heading"><div><div className="eyebrow"><span/> SAVED EVALUATIONS</div><h2>{stats.averageScorePercent ? "RECORDED SCORES." : "READY WHEN YOU ARE."}</h2></div><Link href="/report" className="icon-button" aria-label="View evaluations"><MoreHorizontal size={17}/></Link></div><div className="progress-ring-wrap"><div className="progress-ring" style={{ background: `conic-gradient(var(--gold) 0deg ${Math.round((stats.averageScorePercent / 100) * 360)}deg, #292720 ${Math.round((stats.averageScorePercent / 100) * 360)}deg 360deg)` }}><div><strong>{stats.averageScorePercent}%</strong><span>AVERAGE</span></div></div></div><div className="progress-details"><span><i className="status-dot dot-green"/> Evaluated attempts</span><strong>{stats.attempts - stats.pendingEvaluations}</strong><span><i className="status-dot dot-yellow"/> Pending evaluation</span><strong>{stats.pendingEvaluations}</strong></div><div className="focus-note"><span className="focus-icon"><BookOpen size={15}/></span><p><b>Test-ready papers</b><br/>{testCount ? `${testCount} question paper${testCount === 1 ? "" : "s"} available to attempt.` : "No question papers found in the current index."}</p><ArrowRight size={14}/></div></section></div>
    <section className="dashboard-panel history-panel"><div className="panel-heading"><div><div className="eyebrow"><span/> YOUR SAVED WORK</div><h2>RECENT ATTEMPTS</h2></div><Link href="/report" className="inline-link">Evaluations <ArrowUpRight size={14}/></Link></div>
      {attempts.length === 0 ? <div className="resource-empty history-empty"><FileCheck2 size={20}/><b>No attempts yet.</b><span>Start a test from an indexed question paper to see it here.</span></div> : <div className="history-table"><div className="history-head"><span>PAPER</span><span>STARTED</span><span>RESULT</span><span>STATUS</span><span/></div>{attempts.slice(0, 8).map((attempt) => { const paper = manifest?.papers.find((item) => item.id === attempt.paperId); return <Link href={`/report?attemptId=${encodeURIComponent(attempt.id)}`} key={attempt.id} className="history-row"><span className="history-paper"><b>{paper?.title ?? "Indexed paper no longer available"}</b><small>CBSE Class 12 · Computer Science</small></span><span>{formatDate(attempt.startedAt)}</span><strong>{attempt.status === "evaluated" ? "Score recorded" : "—"}</strong><span className={`table-status ${attempt.status === "submitted" ? "pending" : "good"}`}><i/> {attempt.status === "submitted" ? "Awaiting review" : attempt.status === "evaluated" ? "Evaluated" : "In progress"}</span><ArrowRight size={14}/></Link>; })}</div>}
    </section>
    {manifest?.unreadableFiles.length ? <div className="index-warning">{manifest.unreadableFiles.length} file(s) could not be indexed. See the manifest for file paths and errors.</div> : null}
    <div className="app-footnote">CBSE CLASS 12 · COMPUTER SCIENCE <span>·</span> DATA FROM THIS BROWSER</div></div></main>;
}

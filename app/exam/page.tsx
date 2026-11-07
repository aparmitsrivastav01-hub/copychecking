"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  FileUp,
  Flag,
  Maximize2,
  Save,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { AppNav } from "@/components/ui";
import { getPaperFileUrl, listPapers } from "@/lib/repositories/paperRepository";
import {
  getAttemptById,
  startAttempt,
  updateAttempt,
} from "@/lib/repositories/localRepository";
import type { PaperRecord, StudentAttempt } from "@/lib/models";

const examQuestions = [
  {
    id: 1,
    section: "SECTION A · 1 MARK",
    title: "State True or False: In Python, data type of 74 is same as the data type of 74.0.",
    marks: 1,
    topic: "Python · Data Types",
  },
  {
    id: 2,
    section: "SECTION A · 1 MARK",
    title: "Identify the output: s = 'the Truth'; print(s.capitalize())",
    marks: 1,
    topic: "Python · String Methods",
  },
  {
    id: 3,
    section: "SECTION A · 1 MARK",
    title: "Which of the following expressions in Python evaluates to True? (A) 2>3 and 2<3 (B) 3>1 and 2 (C) 3>1 and 3>2 (D) 3>1 and 3<2",
    marks: 1,
    topic: "Python · Logical Operators",
  },
  {
    id: 4,
    section: "SECTION A · 1 MARK",
    title: "What is the output: s = 'War and Peace by Leo Tolstoy'; print(s.partition('by'))",
    marks: 1,
    topic: "Python · String Partition",
  },
  {
    id: 5,
    section: "SECTION A · 1 MARK",
    title: "What will be the output of the statement: print('PythonProgram'[-1:2:-2])",
    marks: 1,
    topic: "Python · Negative Slicing",
  },
  {
    id: 6,
    section: "SECTION B · 2 MARKS",
    title: "Explain the difference between mutable and immutable data types in Python with suitable examples of each.",
    marks: 2,
    topic: "Python · Mutability",
  },
  {
    id: 7,
    section: "SECTION B · 2 MARKS",
    title: "Write an SQL query to display the department name and total employees from table `EMP` grouped by department.",
    marks: 2,
    topic: "SQL · Group By & Aggregation",
  },
  {
    id: 8,
    section: "SECTION C · 3 MARKS",
    title: "Write a function `count_words()` in Python to read lines from a text file 'STORY.TXT' and count words starting with vowel letters.",
    marks: 3,
    topic: "File Handling · Text Files",
  },
  {
    id: 9,
    section: "SECTION C · 3 MARKS",
    title: "A school campus has 4 blocks. Suggest the most suitable cable layout and network topology to connect all blocks with minimum wire length.",
    marks: 3,
    topic: "Networking · Case Study",
  },
  {
    id: 10,
    section: "SECTION D · 5 MARKS",
    title: "Write functions in Python to perform Push and Pop operations on a Stack containing Book details [BookNo, BookName]. Handle underflow.",
    marks: 5,
    topic: "Data Structures · Stack Implementation",
  },
];

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${h} : ${m} : ${s}`;
};

function ExamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramPaperId = searchParams.get("paperId");
  const paramAttemptId = searchParams.get("attemptId");

  const { progress, update } = useApp();

  const [paper, setPaper] = useState<PaperRecord | null>(null);
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"questions" | "paper">("questions");

  const [current, setCurrent] = useState(1);
  const [remaining, setRemaining] = useState<number>(progress.examRemaining || 180 * 60);
  const [notes, setNotes] = useState<Record<string, string>>(progress.examAnswers || {});
  const [savedAt, setSavedAt] = useState(Date.now());
  const [showSubmit, setShowSubmit] = useState(false);

  // Load paper & attempt
  useEffect(() => {
    listPapers().then((manifest) => {
      const targetPaperId =
        paramPaperId || progress.selectedPaperId || manifest.papers[0]?.id;
      const targetPaper =
        manifest.papers.find((p) => p.id === targetPaperId) ?? manifest.papers[0] ?? null;

      setPaper(targetPaper);

      if (targetPaper) {
        let currentAttempt: StudentAttempt | null = null;
        if (paramAttemptId) {
          currentAttempt = getAttemptById(paramAttemptId);
        } else if (progress.currentAttemptId) {
          currentAttempt = getAttemptById(progress.currentAttemptId);
        }

        if (!currentAttempt || currentAttempt.paperId !== targetPaper.id) {
          currentAttempt = startAttempt(targetPaper.id, targetPaper.durationMinutes);
        }

        setAttempt(currentAttempt);
        const rem = currentAttempt.remainingSeconds ?? (targetPaper.durationMinutes ?? 180) * 60;
        setRemaining(rem);
        setNotes(currentAttempt.notes || {});

        update({
          selectedPaperId: targetPaper.id,
          currentAttemptId: currentAttempt.id,
          examRemaining: rem,
          examAnswers: currentAttempt.notes || {},
          examStartedAt: Date.now(),
        });
      }

      setLoading(false);
    });
  }, [paramPaperId, paramAttemptId]);

  // Timer interval & progress persistence
  useEffect(() => {
    if (loading || !attempt) return;

    const interval = window.setInterval(() => {
      setRemaining((value) => {
        const next = Math.max(value - 1, 0);

        // Periodically sync to storage
        if (Date.now() - savedAt > 5000) {
          updateAttempt(attempt.id, {
            remainingSeconds: next,
            notes,
          });
          update({ examRemaining: next, examAnswers: notes });
          setSavedAt(Date.now());
        }

        if (next === 0) setShowSubmit(true);
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loading, attempt, notes, savedAt, update]);

  const question = examQuestions[current - 1] ?? examQuestions[0];
  const answeredCount = useMemo(
    () => Object.keys(notes).filter((k) => notes[k]?.trim()).length,
    [notes]
  );

  const changeNote = (value: string) => {
    const next = { ...notes, [String(current)]: value };
    setNotes(next);
    if (attempt) {
      updateAttempt(attempt.id, { notes: next });
    }
  };

  const submitToUpload = () => {
    if (attempt) {
      updateAttempt(attempt.id, {
        remainingSeconds: remaining,
        notes,
      });
      update({
        examRemaining: remaining,
        examAnswers: notes,
        currentAttemptId: attempt.id,
      });
      router.push(`/upload?attemptId=${encodeURIComponent(attempt.id)}`);
    } else {
      router.push("/upload");
    }
  };

  if (loading) {
    return (
      <main className="app-frame">
        <AppNav active="/test" />
        <div className="exam-wrap" style={{ textAlign: "center", padding: "80px 0" }}>
          <div className="eyebrow"><span /> CBSE CLASS 12 · COMPUTER SCIENCE</div>
          <h2 style={{ marginTop: "14px" }}>INITIALIZING EXAM ENVIRONMENT...</h2>
        </div>
      </main>
    );
  }

  if (!paper) {
    return (
      <main className="app-frame">
        <AppNav active="/test" />
        <div className="exam-wrap" style={{ textAlign: "center", padding: "80px 0" }}>
          <h2>No question paper found.</h2>
          <p>Please return to the catalogue to choose an authentic question paper.</p>
          <Link href="/test" className="button button-gold" style={{ marginTop: "16px" }}>
            Return to Catalogue
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="app-frame">
      <AppNav active="/test" />
      <div className="exam-wrap">
        {/* Top bar with Paper Info and Timer */}
        <div className="exam-topline">
          <Link href="/test" className="exam-back">
            <ArrowLeft size={15} /> Exit paper
          </Link>

          <div className="exam-paper-meta">
            <span>CBSE CLASS 12 COMPUTER SCIENCE</span>
            <i>·</i> {paper.title}
          </div>

          <div className={`exam-timer ${remaining < 900 ? "timer-low" : ""}`}>
            <Clock3 size={14} />
            {formatTime(remaining)}
          </div>
        </div>

        {/* View mode toggle and progress */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "16px",
            marginBottom: "8px",
          }}
        >
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              className={`button button-small ${viewMode === "questions" ? "button-gold" : "button-outline"}`}
              onClick={() => setViewMode("questions")}
            >
              <FileText size={12} /> Questions Guide
            </button>
            <button
              className={`button button-small ${viewMode === "paper" ? "button-gold" : "button-outline"}`}
              onClick={() => setViewMode("paper")}
            >
              <Maximize2 size={12} /> Original Paper Document
            </button>
            <a
              href={getPaperFileUrl(paper)}
              target="_blank"
              rel="noreferrer"
              className="button button-small button-outline"
              title="Open document in separate browser tab"
            >
              <ExternalLink size={12} /> External Tab
            </a>
          </div>

          <div className="exam-progress-row" style={{ margin: 0, minWidth: "240px" }}>
            <span>
              <b>QUESTION {String(current).padStart(2, "0")}</b> / {String(examQuestions.length).padStart(2, "0")}
            </span>
            <div className="exam-progress-track">
              <i style={{ width: `${(current / examQuestions.length) * 100}%` }} />
            </div>
            <span>{answeredCount} NOTED</span>
          </div>
        </div>

        {/* Workspace: Either Questions Guide or Original Document */}
        {viewMode === "paper" ? (
          <div
            style={{
              background: "#080808",
              border: "1px solid var(--line)",
              padding: "12px",
              minHeight: "560px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                fontSize: "10px",
                color: "var(--muted)",
              }}
            >
              <span>
                <b>Viewing Original Question Paper:</b> {paper.filename} ({paper.maximumMarks ?? 70} Marks · {paper.durationMinutes ?? 180} Mins)
              </span>
              <span>Write your answers on your answer sheet</span>
            </div>
            <iframe
              src={getPaperFileUrl(paper)}
              title={paper.title}
              style={{
                width: "100%",
                height: "640px",
                border: "none",
                background: "#fff",
              }}
            />
          </div>
        ) : (
          <div className="exam-workspace">
            {/* Sidebar Question Navigator */}
            <aside className="question-nav">
              <div className="question-nav-title">
                QUESTION SECTIONS <span>{examQuestions.length} GUIDE Qs</span>
              </div>
              <div className="question-nav-list">
                {examQuestions.map((q) => (
                  <button
                    key={q.id}
                    className={`${current === q.id ? "current" : ""} ${notes[String(q.id)]?.trim() ? "has-answer" : ""}`}
                    onClick={() => setCurrent(q.id)}
                  >
                    <span>{String(q.id).padStart(2, "0")}</span>
                    <i>{notes[String(q.id)]?.trim() ? <Check size={11} /> : null}</i>
                    <small>{q.topic}</small>
                  </button>
                ))}
              </div>
              <div className="nav-save">
                <Save size={13} /> Stored in browser
              </div>
            </aside>

            {/* Main Question Panel */}
            <section className="question-panel">
              <div className="question-meta">
                <span>{question.section}</span>
                <span>
                  {question.marks} {question.marks === 1 ? "MARK" : "MARKS"}
                </span>
              </div>

              <h1>{question.title}</h1>

              <div className="question-note">
                <span>WORK IT OUT ON YOUR PHYSICAL ANSWER SHEET</span>
                <p>
                  Show your complete steps, trace tables, code syntax, and reasoning clearly. Stepwise marking is applied according to CBSE evaluation criteria.
                </p>
              </div>

              <label className="answer-label" htmlFor="answer-notes">
                ROUGH NOTES &amp; CODE SCRATCHPAD <span>optional · saved automatically</span>
              </label>
              <textarea
                id="answer-notes"
                value={notes[String(current)] ?? ""}
                onChange={(e) => changeNote(e.target.value)}
                placeholder="Jot down quick reminders, code traces, or formula notes here..."
              />

              <div className="question-bottom">
                <span>
                  <Flag size={13} /> {question.topic}
                </span>
                <div>
                  <button
                    className="button button-outline"
                    disabled={current === 1}
                    onClick={() => setCurrent((v) => v - 1)}
                  >
                    <ChevronLeft size={15} /> Previous
                  </button>
                  {current === examQuestions.length ? (
                    <button
                      className="button button-gold"
                      onClick={() => setShowSubmit(true)}
                    >
                      Finish Paper <ArrowRight size={15} />
                    </button>
                  ) : (
                    <button
                      className="button button-gold"
                      onClick={() => setCurrent((v) => v + 1)}
                    >
                      Next question <ChevronRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Bottom Utility Bar */}
        <div className="exam-utility">
          <div>
            <FileUp size={15} />
            <span>
              Done writing? You will photograph or scan your handwritten pages and upload them for evaluation.
            </span>
          </div>
          <button onClick={() => setShowSubmit(true)}>
            Finish paper &amp; Upload Sheet <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showSubmit && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowSubmit(false);
          }}
        >
          <section
            className="submit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
          >
            <button
              className="modal-close"
              onClick={() => setShowSubmit(false)}
              aria-label="Close modal"
            >
              ×
            </button>
            <div className="modal-icon">
              <FileUp size={20} />
            </div>
            <div className="eyebrow">
              <span /> TIME TO UPLOAD YOUR ANSWER SHEET
            </div>
            <h2 id="submit-title">FINISH YOUR TEST.</h2>
            <p>
              You have completed your test session for <b>{paper.title}</b>. In the next step, you will upload clear photos of your handwritten answer pages or a PDF.
            </p>
            <div className="modal-actions">
              <button
                className="button button-outline"
                onClick={() => setShowSubmit(false)}
              >
                Keep working
              </button>
              <button className="button button-gold" onClick={submitToUpload}>
                Proceed to Upload <ArrowRight size={14} />
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function ExamPage() {
  return (
    <Suspense
      fallback={
        <main className="app-frame">
          <AppNav active="/test" />
          <div className="exam-wrap" style={{ textAlign: "center", padding: "80px 0" }}>
            <div className="eyebrow"><span /> LOADING</div>
            <h2>PREPARING EXAM...</h2>
          </div>
        </main>
      }
    >
      <ExamContent />
    </Suspense>
  );
}

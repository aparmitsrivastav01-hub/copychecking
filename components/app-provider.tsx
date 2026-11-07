"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readExamState, writeExamState } from "@/lib/repositories/localRepository";

export interface ExamProgress {
  selectedPaperId: string | null;
  currentAttemptId: string | null;
  examStartedAt: number | null;
  examRemaining: number;
  examAnswers: Record<string, string>;
  uploadedNames: string[];
  lastSubmittedAttemptId: string | null;
}

const defaultExamProgress: ExamProgress = {
  selectedPaperId: null,
  currentAttemptId: null,
  examStartedAt: null,
  examRemaining: 180 * 60,
  examAnswers: {},
  uploadedNames: [],
  lastSubmittedAttemptId: null,
};

interface AppContextValue {
  progress: ExamProgress;
  update: (changes: Partial<ExamProgress>) => void;
  resetExam: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ExamProgress>(defaultExamProgress);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readExamState<ExamProgress>();
    if (saved) {
      setProgress((prev) => ({ ...prev, ...saved }));
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      writeExamState(progress);
    }
  }, [progress, ready]);

  const update = useCallback((changes: Partial<ExamProgress>) => {
    setProgress((current) => ({ ...current, ...changes }));
  }, []);

  const resetExam = useCallback(() => {
    setProgress(defaultExamProgress);
    writeExamState(defaultExamProgress);
  }, []);

  const value = useMemo(
    () => ({ progress, update, resetExam }),
    [progress, update, resetExam]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}

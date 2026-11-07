import assert from "node:assert";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Mock localStorage for Node environment test
const storage = new Map();
global.window = {};
global.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

async function testCompleteFlow() {
  console.log("==================================================");
  console.log("TESTING GENUINE EVALUATION & SUBMISSION FLOW");
  console.log("==================================================");

  // 1. Verify manifest exists and papers are discovered
  const manifestPath = path.join(projectRoot, "data", "papers-manifest.json");
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);

  console.log("1. Checking Paper Discovery...");
  assert.ok(manifest.papers.length > 0, "At least one paper should be discovered");
  const primaryPaper = manifest.papers[0];
  console.log(`   Found paper: "${primaryPaper.title}"`);
  console.log(`   Format: ${primaryPaper.format}, Size: ${primaryPaper.sizeBytes} bytes`);
  console.log(`   Marks: ${primaryPaper.maximumMarks}, Duration: ${primaryPaper.durationMinutes} min`);
  assert.strictEqual(primaryPaper.format, "pdf");
  assert.strictEqual(primaryPaper.maximumMarks, 70);
  assert.strictEqual(primaryPaper.durationMinutes, 180);

  // Import repositories
  const {
    listAttempts,
    startAttempt,
    updateAttempt,
    submitAttempt,
    listEvaluations,
    createPendingEvaluation,
    completeEvaluation,
    getDashboardStatistics,
    clearAllLocalData,
  } = await import("../lib/repositories/localRepository.ts");

  // 2. Verify initial empty states
  console.log("\n2. Checking Empty State / Zero Dashboard Statistics...");
  clearAllLocalData();
  const initialStats = getDashboardStatistics();
  console.log("   Initial Stats:", initialStats);
  assert.strictEqual(initialStats.attempts, 0, "Attempts should be 0 on clean state");
  assert.strictEqual(initialStats.averageScorePercent, 0, "Average score should be 0%");
  assert.strictEqual(initialStats.pendingEvaluations, 0, "Pending should be 0");
  assert.strictEqual(initialStats.personalBestPercent, 0, "Personal best should be 0%");
  assert.strictEqual(listAttempts().length, 0, "Attempts list should be empty");
  assert.strictEqual(listEvaluations().length, 0, "Evaluations list should be empty");
  console.log("   ✓ Verified: Clean zero state.");

  // 3. Start test action
  console.log("\n3. Testing 'Start Test' Flow...");
  const attempt = startAttempt(primaryPaper.id, primaryPaper.durationMinutes);
  console.log(`   Started attempt: ${attempt.id} for paper: ${attempt.paperId}`);
  assert.strictEqual(attempt.status, "in_progress");
  assert.strictEqual(attempt.paperId, primaryPaper.id);

  // 4. Test progress tracking
  console.log("\n4. Testing Test Progress Maintenance...");
  const updatedAttempt = updateAttempt(attempt.id, {
    notes: {
      "1": "False. 74 is int, 74.0 is float in Python.",
      "2": "Capitalized output string is 'The truth'",
    },
    remainingSeconds: 175 * 60,
  });
  assert.ok(updatedAttempt);
  assert.strictEqual(updatedAttempt.notes["1"], "False. 74 is int, 74.0 is float in Python.");
  assert.strictEqual(updatedAttempt.remainingSeconds, 175 * 60);
  console.log("   ✓ Verified: In-progress notes and timer persisted.");

  // 5. Submit answer pages with strict ordering preserved
  console.log("\n5. Testing Answer Sheet Submission & Page Preservation...");
  const submitted = submitAttempt(attempt.id, [
    { name: "ans_page_1_sec_a.jpg", size: 1024000, type: "image/jpeg" },
    { name: "ans_page_2_sec_b.jpg", size: 1056000, type: "image/jpeg" },
    { name: "ans_page_3_sec_c_d.jpg", size: 980000, type: "image/jpeg" },
  ]);
  assert.ok(submitted);
  assert.strictEqual(submitted.status, "submitted");
  assert.strictEqual(submitted.answerFiles.length, 3);
  assert.strictEqual(submitted.answerPages.length, 3);
  assert.strictEqual(submitted.answerPages[0].pageNumber, 1);
  assert.strictEqual(submitted.answerPages[0].fileName, "ans_page_1_sec_a.jpg");
  assert.strictEqual(submitted.answerPages[1].pageNumber, 2);
  assert.strictEqual(submitted.answerPages[2].pageNumber, 3);
  console.log(`   Submitted attempt with ${submitted.answerPages.length} ordered pages.`);
  console.log("   ✓ Verified: Uploaded pages and sequence are strictly preserved.");

  // 6. Genuine Pending Evaluation (NO arbitrary/simulated scores)
  console.log("\n6. Testing Genuine Pending Evaluation (No Fake Scores)...");
  const pendingEval = createPendingEvaluation(submitted, primaryPaper);
  console.log(`   Evaluation created: ${pendingEval.id}`);
  console.log(`   Status: ${pendingEval.status}`);
  console.log(`   Score: ${pendingEval.score}`);
  console.log(`   Questions in queue: ${pendingEval.questions.length}`);

  assert.strictEqual(pendingEval.status, "pending");
  assert.strictEqual(pendingEval.score, null, "Score must be null while evaluation is pending");
  assert.strictEqual(pendingEval.percentage, null, "Percentage must be null while evaluation is pending");
  assert.strictEqual(pendingEval.evaluatedAt, null, "Evaluated date must be null while pending");
  assert.strictEqual(pendingEval.source, "pending");
  assert.strictEqual(pendingEval.questions.length, 10, "All 10 questions mapped from CBSE paper");
  assert.strictEqual(pendingEval.questions[0].status, "pending");
  assert.strictEqual(pendingEval.questions[0].awardedMarks, null);
  assert.strictEqual(pendingEval.questions[0].extractedText, null);
  assert.ok(pendingEval.questions[0].markingCriteria.length > 0, "Marking criteria defined");
  console.log("   ✓ Verified: Evaluation status is separated from submission status.");
  console.log("   ✓ Verified: Absolutely no fabricated scores or marks were generated.");

  // 7. Verify Dashboard statistics during Pending Evaluation
  console.log("\n7. Verifying Dashboard Statistics for Pending Evaluation...");
  const pendingStats = getDashboardStatistics();
  console.log("   Pending Dashboard Stats:", pendingStats);
  assert.strictEqual(pendingStats.attempts, 1, "Attempts count should be 1 (submitted)");
  assert.strictEqual(pendingStats.pendingEvaluations, 1, "Pending evaluations count should be 1");
  assert.strictEqual(pendingStats.averageScorePercent, 0, "Average score must NOT count pending submissions");
  assert.strictEqual(pendingStats.personalBestPercent, 0, "Personal best must NOT count pending submissions");
  console.log("   ✓ Verified: Dashboard statistics accurately reflect pending evaluation.");

  // 8. Genuine Evaluation Completion (Future Gemini Vision / Teacher Evaluator Pipeline)
  console.log("\n8. Testing Evaluation Completion Pipeline...");
  const completedEval = completeEvaluation(
    pendingEval.id,
    [
      {
        questionId: "q1",
        extractedText: "False. 74 is int whereas 74.0 is floating point.",
        awardedMarks: 1,
        evaluatorFeedback: "Accurate distinction between int and float types.",
        evaluatorConfidence: 0.98,
      },
      {
        questionId: "q2",
        extractedText: "The truth",
        awardedMarks: 1,
        evaluatorFeedback: "Correct capitalized string output.",
        evaluatorConfidence: 0.99,
      },
      {
        questionId: "q3",
        extractedText: "(C)",
        awardedMarks: 1,
        evaluatorFeedback: "Correct logical expression selection.",
        evaluatorConfidence: 1.0,
      },
      {
        questionId: "q4",
        extractedText: "('War and Peace ', 'by', ' Leo Tolstoy')",
        awardedMarks: 1,
        evaluatorFeedback: "Correct tuple partitioning.",
        evaluatorConfidence: 0.97,
      },
      {
        questionId: "q5",
        extractedText: "mroPr",
        awardedMarks: 1,
        evaluatorFeedback: "Correct step slice result.",
        evaluatorConfidence: 0.95,
      },
      {
        questionId: "q6",
        extractedText: "Mutable: lists. Immutable: tuples. Mutable objects can be modified in place.",
        awardedMarks: 2,
        evaluatorFeedback: "Valid definition and examples.",
        evaluatorConfidence: 0.92,
      },
      {
        questionId: "q7",
        extractedText: "SELECT dept, count(*) FROM EMP GROUP BY dept;",
        awardedMarks: 2,
        evaluatorFeedback: "Correct grouping and aggregate count.",
        evaluatorConfidence: 0.96,
      },
      {
        questionId: "q8",
        extractedText: "def count_words(): with open('STORY.TXT') as f: ...",
        awardedMarks: 3,
        evaluatorFeedback: "File handling and vowel condition implemented correctly.",
        evaluatorConfidence: 0.91,
      },
      {
        questionId: "q9",
        extractedText: "Star topology using switch with server in Block A.",
        awardedMarks: 3,
        evaluatorFeedback: "Topology and layout justified based on computer density.",
        evaluatorConfidence: 0.89,
      },
      {
        questionId: "q10",
        extractedText: "def push(s, item): s.append(item); def pop(s): if len(s)==0: return None; return s.pop()",
        awardedMarks: 5,
        evaluatorFeedback: "Full marks for push, pop and underflow validation.",
        evaluatorConfidence: 0.94,
      },
    ],
    "Demonstrated solid conceptual mastery across Python fundamentals, SQL aggregation, and data structure operations.",
    "hybrid"
  );

  assert.ok(completedEval);
  assert.strictEqual(completedEval.status, "completed");
  assert.strictEqual(completedEval.score, 20); // sum of marks (1+1+1+1+1+2+2+3+3+5 = 20)
  assert.strictEqual(completedEval.maximumMarks, 70);
  assert.strictEqual(completedEval.percentage, Math.round((20 / 70) * 100)); // 29%
  console.log(`   Completed evaluation score: ${completedEval.score} / ${completedEval.maximumMarks} (${completedEval.percentage}%)`);

  // 9. Verify Dashboard statistics after genuine evaluation completion
  console.log("\n9. Verifying Dashboard Statistics After Genuine Evaluation...");
  const finalStats = getDashboardStatistics();
  console.log("   Final Dashboard Stats:", finalStats);
  assert.strictEqual(finalStats.attempts, 1);
  assert.strictEqual(finalStats.pendingEvaluations, 0);
  assert.strictEqual(finalStats.averageScorePercent, completedEval.percentage);
  assert.strictEqual(finalStats.personalBestPercent, completedEval.percentage);
  console.log("   ✓ Verified: Stats update only after genuine evaluation completion.");

  console.log("\n==================================================");
  console.log("ALL GENUINE EVALUATION TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

testCompleteFlow().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

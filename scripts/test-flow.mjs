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
  console.log("TESTING PAPERCHECK AI DATA-DRIVEN FLOW");
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
  console.log(`   Year: ${primaryPaper.year ?? "Unknown"}, Session: ${primaryPaper.academicSession ?? "Unknown"}`);
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
    createAutomatedEvaluation,
    saveTeacherReview,
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
  console.log("   ✓ Verified: No fabricated numbers exist in clean state.");

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
  console.log("   ✓ Verified: Real-time progress and rough notes are saved persistently.");

  // 5. Submit answers
  console.log("\n5. Testing Answer Sheet Submission...");
  const submitted = submitAttempt(attempt.id, [
    "page_1_section_a.jpg",
    "page_2_section_b.jpg",
    "page_3_section_c.jpg",
  ]);
  assert.ok(submitted);
  assert.strictEqual(submitted.status, "submitted");
  assert.strictEqual(submitted.answerFiles.length, 3);
  console.log(`   Submitted attempt with ${submitted.answerFiles.length} answer pages.`);

  // 6. Automated evaluation based on real paper criteria
  console.log("\n6. Testing Evaluation Creation...");
  const evaluation = createAutomatedEvaluation(submitted, primaryPaper);
  console.log(`   Evaluation created: ${evaluation.id}`);
  console.log(`   Score: ${evaluation.score} / ${evaluation.maximumMarks} (${evaluation.percentage}%)`);
  assert.strictEqual(evaluation.paperId, primaryPaper.id);
  assert.strictEqual(evaluation.maximumMarks, 70);
  assert.ok(evaluation.score > 0 && evaluation.score <= 70);
  assert.strictEqual(evaluation.percentage, Math.round((evaluation.score / 70) * 100));

  // 7. Verify dashboard statistics update from real data
  console.log("\n7. Verifying Dashboard Statistics Update From Real Data...");
  const updatedStats = getDashboardStatistics();
  console.log("   Updated Dashboard Stats:", updatedStats);
  assert.strictEqual(updatedStats.attempts, 1, "Attempts count should be 1");
  assert.strictEqual(updatedStats.averageScorePercent, evaluation.percentage);
  assert.strictEqual(updatedStats.personalBestPercent, evaluation.percentage);
  assert.strictEqual(updatedStats.pendingEvaluations, 0);
  console.log("   ✓ Verified: Dashboard statistics accurately reflect real evaluation records.");

  // 8. Teacher review mark adjustments
  console.log("\n8. Testing Teacher Review Adjustment Flow...");
  const review = {
    id: "review_test_1",
    evaluationId: evaluation.id,
    attemptId: submitted.id,
    teacherId: "teacher_np",
    adjustments: { q4: 1, q5: 1 },
    note: "Extra partial credit awarded for query reasoning.",
    updatedAt: new Date().toISOString(),
  };
  saveTeacherReview(review);

  const finalEvaluations = listEvaluations();
  const adjustedEval = finalEvaluations.find((e) => e.id === evaluation.id);
  console.log(`   Adjusted score: ${adjustedEval.score} / ${adjustedEval.maximumMarks} (${adjustedEval.percentage}%)`);
  assert.strictEqual(adjustedEval.score, evaluation.score + 2);

  const finalStats = getDashboardStatistics();
  console.log("   Final Dashboard Stats after Teacher Review:", finalStats);
  assert.strictEqual(finalStats.averageScorePercent, adjustedEval.percentage);
  console.log("   ✓ Verified: Teacher review updates evaluation and dashboard statistics.");

  console.log("\n==================================================");
  console.log("ALL DATA-DRIVEN FLOW TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

testCompleteFlow().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

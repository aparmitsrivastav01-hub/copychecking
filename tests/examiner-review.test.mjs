import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Import auth service
import {
  verifyCredentials,
  createSession,
  getSession,
  hasPermission,
  SEEDED_USERS,
} from "../lib/services/authService.ts";

// Import review service
import {
  getAllEvaluations,
  getEvaluationMetrics,
  getEvaluationById,
  approveEvaluation,
  modifyQuestionEvaluation,
  saveDraftReview,
  rejectEvaluation,
} from "../lib/services/reviewService.ts";

console.log("=== TEST SUITE 3: Auth, RBAC & Examiner Review Workflow Verification ===\n");

async function runTests() {
  // Reset store to seeded state for reproducible testing
  const STORE_FILE = path.join(process.cwd(), "data", "evaluations-store.json");
  if (fs.existsSync(STORE_FILE)) {
    fs.unlinkSync(STORE_FILE);
  }

  // Test 1: Authentication & Role-Based Access Control
  console.log("1. Testing Authentication & Credentials Verification...");
  const examinerUser = verifyCredentials("nitin@codebrahmastra.com", "examiner123");
  assert.ok(examinerUser, "Examiner credentials must authenticate successfully");
  assert.equal(examinerUser.role, "examiner");
  assert.equal(examinerUser.name, "Nitin Paliwal");

  const studentUser = verifyCredentials("aarav@papercheck.ai", "student123");
  assert.ok(studentUser, "Student credentials must authenticate successfully");
  assert.equal(studentUser.role, "student");

  const invalidLogin = verifyCredentials("nitin@codebrahmastra.com", "wrongpass");
  assert.equal(invalidLogin, null, "Invalid password must be rejected");

  console.log("✔ Credential verification and user roles verified.");

  // Test 2: Session Management & Permissions
  console.log("\n2. Testing Session Management & Role Permissions...");
  const session = createSession(examinerUser);
  assert.ok(session.token.startsWith("sess_examiner_"));
  assert.ok(session.expiresAt > Date.now());

  const restored = getSession(session.token);
  assert.ok(restored, "Session token must be resolvable");
  assert.equal(restored.user.email, "nitin@codebrahmastra.com");

  assert.equal(hasPermission(examinerUser, ["examiner"]), true);
  assert.equal(hasPermission(examinerUser, ["admin"]), false);
  assert.equal(hasPermission(studentUser, ["examiner"]), false, "Student must NOT have examiner permission");

  const adminUser = SEEDED_USERS.find((u) => u.role === "admin");
  assert.equal(hasPermission(adminUser, ["examiner"]), true, "Admin must have universal permission");
  console.log("✔ Session resolution and RBAC permissions strictly enforced.");

  // Test 3: Review Queue & Metrics
  console.log("\n3. Testing Review Service Queue & Aggregate Metrics...");
  const metrics = getEvaluationMetrics();
  assert.ok(metrics.totalSubmissions >= 3, "Must have seeded evaluation submissions");
  assert.ok(metrics.pendingReview >= 1, "Must have pending review submissions");
  assert.ok(metrics.approvedPublished >= 1, "Must have approved submissions (e.g. Priyansh)");
  console.log(`  Metrics verified: Total=${metrics.totalSubmissions}, Pending=${metrics.pendingReview}, Approved=${metrics.approvedPublished}, Avg=${metrics.averageScore}/70`);

  // Test 4: Detailed Evaluation Inspection
  console.log("\n4. Testing Submission Inspection (Aarav Gupta)...");
  const aaravEval = getEvaluationById("eval_aarav_001");
  assert.ok(aaravEval, "eval_aarav_001 must exist");
  assert.equal(aaravEval.studentName, "Aarav Gupta");
  assert.equal(aaravEval.approvalStatus, "pending_review");
  assert.ok(aaravEval.reviewAlerts.length > 0, "Review alerts must be populated for examiner attention");
  assert.ok(aaravEval.auditLog.length >= 1, "Initial audit trail must record AI evaluation");

  // Verify flagged questions
  const q26 = aaravEval.questions.find((q) => q.number === 26);
  assert.ok(q26, "Q26 must be present");
  assert.equal(q26.needsHumanReview, true, "Q26 must be flagged for human review");
  console.log("✔ Candidate inspection and AI review flags loaded accurately.");

  // Test 5: Examiner Override & Recalculation
  console.log("\n5. Testing Examiner Override & Live Recalculation...");
  const prevScore = aaravEval.score;

  // Examiner Nitin Paliwal modifies Q26 marks from 1.0 to 1.5 with justification
  const modified = modifyQuestionEvaluation(
    "eval_aarav_001",
    "q26",
    {
      marks: 1.5,
      feedback: "Awarded +0.5 mark for identifying error line 4 even with minor syntax formatting.",
      reason: "Examiner recognized valid CBSE alternative syntax",
      flagged: false,
    },
    "Nitin Paliwal"
  );

  assert.ok(modified, "modifyQuestionEvaluation must return updated record");
  const updatedQ26 = modified.questions.find((q) => q.questionId === "q26");
  assert.equal(updatedQ26.examinerMarks, 1.5, "Examiner marks must be updated to 1.5");
  assert.equal(updatedQ26.examinerApproved, true);
  assert.equal(modified.score, prevScore + 0.5, "Total score must increase by exactly 0.5");

  // Check audit log
  const lastAudit = modified.auditLog[modified.auditLog.length - 1];
  assert.equal(lastAudit.action, "marks_modified");
  assert.equal(lastAudit.author, "Nitin Paliwal");
  assert.equal(lastAudit.newMarks, 1.5);
  console.log(`✔ Score recalculated from ${prevScore} -> ${modified.score} with immutable audit log.`);

  // Test 6: Examiner Approval & Student Release
  console.log("\n6. Testing Approval & Student Report Release...");
  const approved = approveEvaluation(
    "eval_aarav_001",
    "Nitin Paliwal",
    "Verified against CBSE QP 91 standard key. Ready for official release."
  );

  assert.ok(approved);
  assert.equal(approved.approvalStatus, "approved");
  assert.equal(approved.approvedBy, "Nitin Paliwal");
  assert.ok(approved.approvedAt);

  const approvalAudit = approved.auditLog[approved.auditLog.length - 1];
  assert.equal(approvalAudit.action, "examiner_approved");
  assert.ok(approvalAudit.details.includes("Official verification signed off"));

  // Verify updated queue metrics
  const updatedMetrics = getEvaluationMetrics();
  assert.equal(updatedMetrics.approvedPublished, metrics.approvedPublished + 1);
  console.log("✔ Official approval signed off and published to student portal.");

  console.log("\nALL AUTH & EXAMINER REVIEW WORKFLOW TESTS PASSED! (100%)\n");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});

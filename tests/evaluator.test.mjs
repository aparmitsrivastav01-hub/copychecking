import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load evaluator logic
import { evaluateSingleQuestion, runFullEvaluation } from '../lib/services/evaluator.ts';
import { loadRubric } from '../lib/services/rubricService.ts';

console.log('=== TEST SUITE 2: Evaluation Engine & Partial Credit Verification ===\n');

async function runTests() {
  const rubric = await loadRubric();

  // Test 1: Section A - Exact and Semantic Matching
  console.log('1. Testing Section A: Exact & Semantic Evaluation...');
  const q1Rubric = rubric.questions.find((q) => q.questionNumber === 1);
  const evalQ1 = evaluateSingleQuestion(q1Rubric, {
    questionNumber: 1,
    answerText: 'False',
    ocrConfidence: 0.98,
  });
  assert.equal(evalQ1.awardedMarks, 1);
  assert.equal(evalQ1.status, 'evaluated');

  // Semantic equivalence (lowercase 'false')
  const evalQ1Lower = evaluateSingleQuestion(q1Rubric, {
    questionNumber: 1,
    answerText: 'false (because 74 is int and 74.0 is float)',
    ocrConfidence: 0.95,
  });
  assert.equal(evalQ1Lower.awardedMarks, 1);

  // Q2 MCQ
  const q2Rubric = rubric.questions.find((q) => q.questionNumber === 2);
  const evalQ2 = evaluateSingleQuestion(q2Rubric, {
    questionNumber: 2,
    answerText: '(A) The truth',
    ocrConfidence: 0.95,
  });
  assert.equal(evalQ2.awardedMarks, 1);

  // Q19 Acronym expansion
  const q19Rubric = rubric.questions.find((q) => q.questionNumber === 19);
  const evalQ19 = evaluateSingleQuestion(q19Rubric, {
    questionNumber: 19,
    answerText: 'Extensible Markup Language',
    ocrConfidence: 0.95,
  });
  assert.equal(evalQ19.awardedMarks, 1);
  console.log('✔ Section A exact and semantic matching evaluated accurately.');

  // Test 2: Partial Credit on Code Debugging (Q26 CountVowels)
  console.log('\n2. Testing Partial Credit on Code Debugging (Q26)...');
  const q26Rubric = rubric.questions.find((q) => q.questionNumber === 26);

  // Student fixes only Error 1 (for ch in s) and Error 3 (c += 1), but misses Error 2 and Error 4
  const partialCodeQ26 = `
def CountVowels(s):
    c = 0
    for ch in s:
        if 'aeiouAEIOU' in ch:
            c += 1
    return(ch)
`;
  const evalQ26Partial = evaluateSingleQuestion(q26Rubric, {
    questionNumber: 26,
    answerText: partialCodeQ26,
    ocrConfidence: 0.95,
  });
  assert.equal(evalQ26Partial.awardedMarks, 1.0, 'Must award exactly 1.0 mark (2 out of 4 errors fixed: 0.5 * 2 = 1.0)');
  assert.ok(evalQ26Partial.deductionReasons && evalQ26Partial.deductionReasons.length > 0, 'Must explain deductions');
  console.log('✔ Partial credit correctly awarded for 2/4 bug corrections without double penalization.');

  // Full fix of Q26
  const fullCodeQ26 = `
def CountVowels(s):
    c = 0
    for ch in s:
        if ch in 'aeiouAEIOU':
            c += 1
    return c
`;
  const evalQ26Full = evaluateSingleQuestion(q26Rubric, {
    questionNumber: 26,
    answerText: fullCodeQ26,
    ocrConfidence: 0.95,
  });
  assert.equal(evalQ26Full.awardedMarks, 2.0, 'Must award full 2.0 marks when all 4 errors fixed');
  console.log('✔ Full credit awarded when all 4 errors are corrected.');

  // Test 3: SQL Query Evaluation (Q32 and Q34)
  console.log('\n3. Testing SQL Query Evaluation (Q32 & Q34)...');
  const q32Rubric = rubric.questions.find((q) => q.questionNumber === 32);

  // Only query 1 and 2 answered correctly
  const partialSql = `
(i) SELECT Type, MAX(Price) FROM STOCK GROUP BY Type;
(ii) UPDATE STOCK SET Price = Price + 0.5 WHERE Type = 'F';
`;
  const evalQ32Partial = evaluateSingleQuestion(q32Rubric, {
    questionNumber: 32,
    answerText: partialSql,
    ocrConfidence: 0.95,
  });
  assert.equal(evalQ32Partial.awardedMarks, 2.0, 'Must award 2.0 marks out of 4.0 for 2 correct sub-queries');
  console.log('✔ SQL partial credit calculated per sub-query.');

  // Q34 Equi-join
  const q34Rubric = rubric.questions.find((q) => q.questionNumber === 34);
  const fullSql34 = `
(i) SELECT COUNT(*) FROM LOANS WHERE RoI > 7.0;
(ii) SELECT C_Name FROM CUSTOMERS, LOANS WHERE CUSTOMERS.C_ID = LOANS.C_ID AND L_Amt > 1000000;
(iii) SELECT CUSTOMERS.C_ID, C_Name, Terms FROM CUSTOMERS, LOANS WHERE CUSTOMERS.C_ID = LOANS.C_ID AND L_Date > '2024-12-31';
(iv) SELECT * FROM LOANS ORDER BY RoI DESC;
`;
  const evalQ34 = evaluateSingleQuestion(q34Rubric, {
    questionNumber: 34,
    answerText: fullSql34,
    ocrConfidence: 0.95,
  });
  assert.equal(evalQ34.awardedMarks, 4.0, 'Must award full 4.0 marks for complete join queries');
  console.log('✔ SQL Joins and aggregate queries evaluated correctly.');

  // Test 4: OCR Ambiguity & Low Confidence Flagging
  console.log('\n4. Testing Low OCR Confidence & Ambiguity Handling...');
  const evalLowOcr = evaluateSingleQuestion(q1Rubric, {
    questionNumber: 1,
    answerText: '[unclear handwriting]',
    ocrConfidence: 0.42,
  });
  assert.equal(evalLowOcr.needsHumanReview, true, 'Low OCR confidence must trigger human review');
  assert.equal(evalLowOcr.status, 'needs_review', 'Status must be needs_review');
  assert.ok(evalLowOcr.reviewFlags && evalLowOcr.reviewFlags.length > 0, 'Review flags must be populated');
  assert.equal(evalLowOcr.awardedMarks, 0, 'Must never fabricate marks for unreadable answer');
  console.log('✔ Low OCR confidence correctly flagged for teacher review without fabricating marks.');

  // Test 5: Full Exam Run (70 Marks)
  console.log('\n5. Testing Complete Paper Evaluation (All 37 Questions)...');
  const sampleAnswers = rubric.questions.map((q) => ({
    questionNumber: q.questionNumber,
    answerText: q.modelAnswer,
    ocrConfidence: 0.95,
  }));

  const fullRun = await runFullEvaluation({
    attemptId: 'test_attempt_001',
    paperId: 'cbse_2025_cs083_set4_qp91',
    answers: sampleAnswers,
  });

  assert.equal(fullRun.maximumMarks, 70);
  assert.equal(fullRun.score, 70);
  assert.equal(fullRun.percentage, 100);
  assert.equal(fullRun.questions.length, 37);

  // Section scores verification
  assert.equal(fullRun.sectionScores.A.scored, 21);
  assert.equal(fullRun.sectionScores.B.scored, 14);
  assert.equal(fullRun.sectionScores.C.scored, 9);
  assert.equal(fullRun.sectionScores.D.scored, 16);
  assert.equal(fullRun.sectionScores.E.scored, 10);
  console.log('✔ Complete exam run awarded 70/70 with authentic section distribution.');

  console.log('\nALL EVALUATION ENGINE TESTS PASSED! (100%)\n');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});

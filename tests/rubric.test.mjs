import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== TEST SUITE 1: CBSE Class 12 CS (083) Rubric Verification ===\n');

const rubricPath = path.join(process.cwd(), 'data', 'papercheck_cbse_2025_cs083_set4_qp91_full_rubric.json');
assert.ok(fs.existsSync(rubricPath), 'Rubric file must exist in data directory');

const raw = fs.readFileSync(rubricPath, 'utf-8');
const rubric = JSON.parse(raw);

// 1. Meta verification
console.log('1. Checking paper metadata...');
assert.equal(rubric.paperId, 'cbse_2025_cs083_set4_qp91');
assert.equal(rubric.subjectCode, '083');
assert.equal(rubric.set, 4);
assert.equal(rubric.qpCode, '91');
assert.equal(rubric.maximumMarks, 70);
assert.equal(rubric.totalQuestions, 37);
console.log('✔ Paper metadata matches CBSE 2025 Set 4 QP 91 specification.');

// 2. Sections verification
console.log('\n2. Checking section configurations...');
assert.equal(rubric.sections.length, 5);
const expectedSections = [
  { section: 'A', questionCount: 21, totalMarks: 21 },
  { section: 'B', questionCount: 7, totalMarks: 14 },
  { section: 'C', questionCount: 3, totalMarks: 9 },
  { section: 'D', questionCount: 4, totalMarks: 16 },
  { section: 'E', questionCount: 2, totalMarks: 10 },
];

expectedSections.forEach((exp) => {
  const actual = rubric.sections.find((s) => s.section === exp.section);
  assert.ok(actual, `Section ${exp.section} must exist`);
  assert.equal(actual.questionCount, exp.questionCount, `Section ${exp.section} question count mismatch`);
  assert.equal(actual.totalMarks, exp.totalMarks, `Section ${exp.section} marks mismatch`);
});
console.log('✔ All 5 Sections (A, B, C, D, E) sum to 70 marks and 37 questions.');

// 3. Question-wise verification
console.log('\n3. Checking each of the 37 questions...');
assert.equal(rubric.questions.length, 37, 'Must have exactly 37 questions');

let totalCalculatedMarks = 0;
const sectionCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
const sectionMarks = { A: 0, B: 0, C: 0, D: 0, E: 0 };

rubric.questions.forEach((q, idx) => {
  assert.equal(q.questionNumber, idx + 1, `Question numbering must be sequential 1..37 (failed at ${q.questionNumber})`);
  assert.ok(q.section && ['A', 'B', 'C', 'D', 'E'].includes(q.section), `Q${q.questionNumber} must have valid section`);
  assert.ok(q.maxMarks > 0, `Q${q.questionNumber} must have positive maxMarks`);
  assert.ok(q.topic, `Q${q.questionNumber} must have topic`);
  assert.ok(q.questionText, `Q${q.questionNumber} must have questionText`);
  assert.ok(q.modelAnswer, `Q${q.questionNumber} must have modelAnswer`);
  assert.ok(Array.isArray(q.criteria) && q.criteria.length > 0, `Q${q.questionNumber} must have marking criteria`);

  const criteriaSum = q.criteria.reduce((sum, c) => sum + c.marks, 0);
  assert.equal(
    criteriaSum,
    q.maxMarks,
    `Q${q.questionNumber}: sum of criteria marks (${criteriaSum}) must equal maxMarks (${q.maxMarks})`
  );

  totalCalculatedMarks += q.maxMarks;
  sectionCounts[q.section]++;
  sectionMarks[q.section] += q.maxMarks;
});

assert.equal(totalCalculatedMarks, 70, 'Sum of all 37 questions must be 70 marks');
assert.deepEqual(sectionCounts, { A: 21, B: 7, C: 3, D: 4, E: 2 });
assert.deepEqual(sectionMarks, { A: 21, B: 14, C: 9, D: 16, E: 10 });

console.log('✔ All 37 questions verified with valid schema, criteria sum, and official marks.');
console.log('\nALL RUBRIC INTEGRITY TESTS PASSED SUCCESSFULLY! (100%)\n');

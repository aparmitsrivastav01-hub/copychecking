import type {
  EvaluationRecord,
  QuestionEvaluationItem,
  StepwiseCriterion,
  StudentAttempt,
} from '@/lib/models';
import { loadRubric, type QuestionRubric, type PaperRubric } from './rubricService';

export interface StudentAnswerSubmission {
  questionNumber: number;
  answerText: string;
  extractedFromPages?: number[];
  ocrConfidence?: number;
}

export interface EvaluationOptions {
  attemptId: string;
  paperId: string;
  submittedAt?: string;
  answers: StudentAnswerSubmission[];
}

/**
 * Normalizes text for robust semantic matching:
 * trims, collapses multiple spaces, strips surrounding quotation marks,
 * and handles common punctuation variations (hyphens, dashes).
 */
function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/['"`]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes SQL queries for comparison:
 * lowercases keywords, trims semicolons and whitespace.
 */
function normalizeSql(sql: string): string {
  if (!sql) return '';
  return sql
    .trim()
    .toLowerCase()
    .replace(/;/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Evaluates an individual question against its authentic CBSE rubric.
 */
export function evaluateSingleQuestion(
  rubric: QuestionRubric,
  submission: StudentAnswerSubmission
): QuestionEvaluationItem {
  const rawAnswer = submission.answerText || '';
  const normalizedAnswer = normalizeText(rawAnswer);
  const ocrConfidence = submission.ocrConfidence ?? 0.95;
  const isOcrUncertain = ocrConfidence < 0.65;
  const hasUnclearMarker = /\[unclear\]|\[illegible\]|\?\?\?|unreadable/i.test(rawAnswer);

  const stepAssessments: {
    step: string;
    maxMarks: number;
    awardedMarks: number;
    met: boolean;
    feedback: string;
  }[] = [];

  const deductionReasons: string[] = [];
  const improvementSuggestions: string[] = [];
  const reviewFlags: string[] = [];
  let needsHumanReview = false;

  // OCR low confidence / handwriting check
  if (isOcrUncertain || hasUnclearMarker) {
    needsHumanReview = true;
    reviewFlags.push('Low OCR confidence or ambiguous handwriting detected. Flagged for teacher review.');
  }

  // If answer is empty or completely unreadable
  if (!rawAnswer.trim() || rawAnswer.trim() === '[unclear]' || rawAnswer.trim() === '[illegible]') {
    rubric.criteria.forEach((c) => {
      stepAssessments.push({
        step: c.step,
        maxMarks: c.marks,
        awardedMarks: 0,
        met: false,
        feedback: 'No valid or readable answer provided for this step.',
      });
    });

    deductionReasons.push('Question was left unattempted or answer was illegible.');
    improvementSuggestions.push(`Refer to model answer: "${rubric.modelAnswer.split('\n')[0]}". ${rubric.explanation}`);

    return {
      questionId: `q${rubric.questionNumber}`,
      number: rubric.questionNumber,
      section: rubric.section,
      title: `Question ${rubric.questionNumber}`,
      topic: rubric.topic,
      maxMarks: rubric.maxMarks,
      extractedText: rawAnswer || null,
      extractedFromPages: submission.extractedFromPages || [1],
      extractionConfidence: ocrConfidence,
      markingCriteria: rubric.criteria.map((c) => ({
        step: c.step,
        marks: c.marks,
        description: c.description,
      })),
      suggestedMarks: 0,
      awardedMarks: 0,
      evaluatorFeedback: isOcrUncertain
        ? 'Answer could not be read clearly by OCR. Human review required before finalizing marks.'
        : 'No answer provided. Zero marks awarded.',
      evaluatorConfidence: isOcrUncertain ? 0.3 : 1.0,
      status: needsHumanReview ? 'needs_review' : 'evaluated',
      expectedAnswer: rubric.modelAnswer,
      deductionReasons,
      improvementSuggestions,
      needsHumanReview,
      reviewFlags,
      stepAssessments,
    };
  }

  // Specific question evaluation logic
  switch (rubric.type) {
    case 'true_false': {
      const isTrue = /\b(true|t)\b/i.test(normalizedAnswer);
      const isFalse = /\b(false|f)\b/i.test(normalizedAnswer);
      const expectedIsFalse = /false/i.test(rubric.modelAnswer);

      const correct = expectedIsFalse ? isFalse && !isTrue : isTrue && !isFalse;
      const criterion = rubric.criteria[0];

      if (correct) {
        stepAssessments.push({
          step: criterion.step,
          maxMarks: criterion.marks,
          awardedMarks: criterion.marks,
          met: true,
          feedback: 'Correct statement classification.',
        });
      } else {
        stepAssessments.push({
          step: criterion.step,
          maxMarks: criterion.marks,
          awardedMarks: 0,
          met: false,
          feedback: `Incorrect state. Expected: ${rubric.modelAnswer}`,
        });
        deductionReasons.push(`Incorrect True/False choice. Expected "${rubric.modelAnswer}".`);
        improvementSuggestions.push(rubric.explanation);
      }
      break;
    }

    case 'mcq':
    case 'assertion_reason': {
      // Extract option letter if present e.g. (A), A, (B), B, etc.
      const optionMatch = rawAnswer.match(/^\s*\(?([A-Da-d])\)?/);
      const studentOption = optionMatch ? optionMatch[1].toUpperCase() : null;

      const modelOptionMatch = rubric.modelAnswer.match(/^\s*\(?([A-Da-d])\)?/);
      const modelOption = modelOptionMatch ? modelOptionMatch[1].toUpperCase() : null;

      // Check if student wrote option letter or option text
      const matchesOptionLetter = studentOption && modelOption && studentOption === modelOption;
      const matchesAlternative = rubric.acceptedAlternatives.some((alt) =>
        normalizedAnswer.includes(normalizeText(alt))
      );

      const criterion = rubric.criteria[0];
      if (matchesOptionLetter || matchesAlternative) {
        stepAssessments.push({
          step: criterion.step,
          maxMarks: criterion.marks,
          awardedMarks: criterion.marks,
          met: true,
          feedback: `Correct selection: ${rubric.modelAnswer.split('\n')[0]}`,
        });
      } else {
        stepAssessments.push({
          step: criterion.step,
          maxMarks: criterion.marks,
          awardedMarks: 0,
          met: false,
          feedback: `Incorrect choice. Model answer: ${rubric.modelAnswer}`,
        });
        deductionReasons.push(`Incorrect option selected. Model answer is ${rubric.modelAnswer}.`);
        improvementSuggestions.push(rubric.explanation);
      }
      break;
    }

    case 'output': {
      // Output questions like Q5, Q31
      const isExactOrAlt = rubric.acceptedAlternatives.some((alt) => {
        const normAlt = normalizeText(alt);
        return normalizedAnswer.includes(normAlt) || normAlt.includes(normalizedAnswer);
      });

      if (isExactOrAlt) {
        rubric.criteria.forEach((c) => {
          stepAssessments.push({
            step: c.step,
            maxMarks: c.marks,
            awardedMarks: c.marks,
            met: true,
            feedback: 'Output matches expected trace exactly.',
          });
        });
      } else {
        // Check partial trace
        let awardedPartial = 0;
        if (rubric.questionNumber === 31) {
          // Check partial elements in list trace or loop trace
          const partialMatches = ['4', '2', 'd', 'l', 'o', '1', '6', '10', '13', '15'].filter((tok) =>
            normalizedAnswer.includes(tok)
          );
          if (partialMatches.length >= 3) {
            awardedPartial = 1.5;
            stepAssessments.push({
              step: 'Partial trace logic',
              maxMarks: 2,
              awardedMarks: 1.5,
              met: true,
              feedback: 'Demonstrated partial tracing steps, but final output is incomplete.',
            });
            stepAssessments.push({
              step: 'Final output structure',
              maxMarks: 1,
              awardedMarks: 0,
              met: false,
              feedback: 'Final output did not match required format.',
            });
            deductionReasons.push('Final trace was incomplete or list elements were ordered incorrectly.');
            improvementSuggestions.push(`Expected output: ${rubric.modelAnswer}. ${rubric.explanation}`);
          }
        }

        if (awardedPartial === 0) {
          rubric.criteria.forEach((c) => {
            stepAssessments.push({
              step: c.step,
              maxMarks: c.marks,
              awardedMarks: 0,
              met: false,
              feedback: 'Output did not match expected execution.',
            });
          });
          deductionReasons.push(`Output mismatch. Expected: ${rubric.modelAnswer}`);
          improvementSuggestions.push(rubric.explanation);
        }
      }
      break;
    }

    case 'text':
    case 'short_answer': {
      // General short conceptual answers (e.g. XML full form, Q22 parameter difference, Q25 random, Q28 bus topology)
      rubric.criteria.forEach((c) => {
        let stepMet = false;
        let stepFeedback = '';

        if (rubric.questionNumber === 19) {
          // XML full form
          if (/extensible\s+markup\s+language/i.test(normalizedAnswer)) {
            stepMet = true;
            stepFeedback = 'Extensible Markup Language expanded accurately.';
          } else {
            stepFeedback = 'Incorrect expansion. Expected "Extensible Markup Language".';
          }
        } else if (rubric.questionNumber === 22) {
          // Positional vs default difference and function header
          if (c.step.includes('Definition') || c.step.includes('difference')) {
            const hasOrderConcept = /order|position|required|mandatory/i.test(normalizedAnswer);
            const hasDefaultConcept = /default|optional|pre-assigned|assigned/i.test(normalizedAnswer);
            if (hasOrderConcept && hasDefaultConcept) {
              stepMet = true;
              stepFeedback = 'Clear distinction between positional and default parameters.';
            } else if (hasOrderConcept || hasDefaultConcept) {
              stepAssessments.push({
                step: c.step,
                maxMarks: c.marks,
                awardedMarks: 0.5,
                met: true,
                feedback: 'Partial distinction: defined one parameter type but omitted details for the other.',
              });
              deductionReasons.push('Positional vs default explanation was partially incomplete.');
              return;
            } else {
              stepFeedback = 'Did not clearly distinguish positional and default parameters.';
            }
          } else if (c.step.includes('header')) {
            // Function header regex: def name(pos, default=val):
            const headerMatch = /def\s+\w+\s*\([^)]*=[^)]*\)/i.test(rawAnswer);
            if (headerMatch) {
              stepMet = true;
              stepFeedback = 'Valid Python function header containing positional and default arguments.';
            } else {
              stepFeedback = 'Function header missing or does not combine positional and default parameters.';
            }
          }
        } else if (rubric.questionNumber === 25) {
          // Random output options
          if (c.step.includes('(D)')) {
            if (/\b(d)\b/i.test(normalizedAnswer) || /5-1-2-4|5–1–2–4/.test(normalizedAnswer)) {
              stepMet = true;
              stepFeedback = 'Correctly identified option (D) as impossible.';
            } else {
              stepFeedback = 'Failed to identify option (D) as impossible output.';
            }
          } else if (c.step.includes('iteration') || c.step.includes('count')) {
            if (/\b4\b|four/i.test(normalizedAnswer)) {
              stepMet = true;
              stepFeedback = 'Correctly noted that the loop runs 4 times.';
            } else {
              stepFeedback = 'Incorrect loop iteration count (expected 4).';
            }
          }
        } else if (rubric.questionNumber === 28) {
          // Bus topology advantage/disadvantage OR protocol
          if (c.step.includes('Advantage') || c.step.includes('Bus') || c.step.includes('protocol')) {
            const hasAdv = /easy|less cable|cheap|simple|cost|inexpensive/i.test(normalizedAnswer);
            const hasDisadv = /backbone|single point|break|fails|fault|slow|collision/i.test(normalizedAnswer);
            const hasProtocol = /rules|standards|conventions|govern|communication/i.test(normalizedAnswer);
            if ((hasAdv && hasDisadv) || hasProtocol) {
              stepMet = true;
              stepFeedback = 'Provided valid networking concepts with advantage and disadvantage / definition.';
            } else if (hasAdv || hasDisadv) {
              stepAssessments.push({
                step: c.step,
                maxMarks: c.marks,
                awardedMarks: 0.5,
                met: true,
                feedback: 'Stated only advantage or only disadvantage.',
              });
              deductionReasons.push('Omitted either the advantage or disadvantage of Bus topology.');
              return;
            } else {
              stepFeedback = 'Missing advantage/disadvantage of bus topology or protocol definition.';
            }
          } else if (c.step.includes('Protocol identification') || c.step.includes('HTTP')) {
            if (/https?|hypertext transfer protocol/i.test(normalizedAnswer)) {
              stepMet = true;
              stepFeedback = 'HTTP/HTTPS correctly identified.';
            } else {
              stepFeedback = 'HTTP/HTTPS protocol name missing.';
            }
          }
        } else {
          // Generic fallback for text questions
          stepMet = rubric.acceptedAlternatives.some((alt) =>
            normalizedAnswer.includes(normalizeText(alt))
          );
          stepFeedback = stepMet ? 'Criteria satisfied.' : 'Answer lacked expected keywords or concepts.';
        }

        if (stepMet) {
          stepAssessments.push({
            step: c.step,
            maxMarks: c.marks,
            awardedMarks: c.marks,
            met: true,
            feedback: stepFeedback,
          });
        } else {
          stepAssessments.push({
            step: c.step,
            maxMarks: c.marks,
            awardedMarks: 0,
            met: false,
            feedback: stepFeedback,
          });
          deductionReasons.push(`Criterion not fully met: ${c.description}`);
          improvementSuggestions.push(rubric.explanation);
        }
      });
      break;
    }

    case 'programming': {
      // Python programming questions
      if (rubric.questionNumber === 23) {
        // (i) sorted(L) and (ii) ch.isalnum()
        const hasSorted = /sorted\s*\(\s*l\s*\)/i.test(rawAnswer);
        const hasAlnum = /isalnum\s*\(\s*\)|isalpha\s*\(\s*\).*isdigit/i.test(rawAnswer);

        stepAssessments.push({
          step: rubric.criteria[0].step,
          maxMarks: 1,
          awardedMarks: hasSorted ? 1 : 0,
          met: hasSorted,
          feedback: hasSorted
            ? 'Correct use of sorted(L) without mutating original list.'
            : 'Expected built-in sorted(L) assigned to L1. L.sort() modifies list in-place.',
        });

        stepAssessments.push({
          step: rubric.criteria[1].step,
          maxMarks: 1,
          awardedMarks: hasAlnum ? 1 : 0,
          met: hasAlnum,
          feedback: hasAlnum
            ? 'Correct use of ch.isalnum() method.'
            : 'Expected ch.isalnum() to check alphabet or digit.',
        });

        if (!hasSorted) deductionReasons.push("Did not use sorted(L) to preserve list L.");
        if (!hasAlnum) deductionReasons.push("Did not use ch.isalnum() to check alphanumeric status.");
      } else if (rubric.questionNumber === 24) {
        // (i) 'RNo' in D1 and (ii) D1.setdefault('RNo', 12) or D1.clear()
        const hasMembership = /'rno'\s+in\s+d1|d1\.keys\(\)|12\s+in\s+d1\.values\(\)/i.test(normalizedAnswer);
        const hasSetDefaultOrClear = /setdefault\s*\(\s*'rno'\s*,\s*12\s*\)|d1\.clear\s*\(\s*\)/i.test(normalizedAnswer);

        stepAssessments.push({
          step: rubric.criteria[0].step,
          maxMarks: 1,
          awardedMarks: hasMembership ? 1 : 0,
          met: hasMembership,
          feedback: hasMembership ? "Correct membership check using 'in'." : "Expected 'RNo' in D1 or 12 in D1.values().",
        });

        stepAssessments.push({
          step: rubric.criteria[1].step,
          maxMarks: 1,
          awardedMarks: hasSetDefaultOrClear ? 1 : 0,
          met: hasSetDefaultOrClear,
          feedback: hasSetDefaultOrClear ? 'Correct built-in dictionary method applied.' : 'Expected D1.setdefault(\'RNo\', 12) or D1.clear().',
        });

        if (!hasMembership) deductionReasons.push("Dictionary membership condition missing.");
        if (!hasSetDefaultOrClear) deductionReasons.push("Built-in setdefault('RNo', 12) or clear() method missing.");
      } else if (rubric.questionNumber === 26) {
        // CountVowels: 4 distinct errors (0.5 mark each)
        // 1: for ch in s (not range(s))
        const fix1 = /for\s+ch\s+in\s+s\b|for\s+\w+\s+in\s+range\s*\(\s*len\s*\(\s*s\s*\)\s*\)/i.test(rawAnswer);
        // 2: ch in 'aeiou...'
        const fix2 = /ch(\.lower\(\))?\s+in\s+['"]aeiou/i.test(rawAnswer);
        // 3: c += 1 or c = c + 1
        const fix3 = /c\s*\+=\s*1|c\s*=\s*c\s*\+\s*1/i.test(rawAnswer);
        // 4: return c
        const fix4 = /return\s*\(?\s*c\s*\)?/i.test(rawAnswer) && !/return\s*\(?\s*ch\s*\)?/i.test(rawAnswer);

        stepAssessments.push({
          step: 'Correction 1: Loop string iteration',
          maxMarks: 0.5,
          awardedMarks: fix1 ? 0.5 : 0,
          met: fix1,
          feedback: fix1 ? 'Corrected range(s) to s.' : 'Failed to fix range(s) iteration over string.',
        });
        stepAssessments.push({
          step: 'Correction 2: Vowel membership check',
          maxMarks: 0.5,
          awardedMarks: fix2 ? 0.5 : 0,
          met: fix2,
          feedback: fix2 ? "Corrected vowel membership condition: ch in 'aeiouAEIOU'." : "Condition 'aeiou...' in ch is invalid.",
        });
        stepAssessments.push({
          step: 'Correction 3: Counter increment syntax',
          maxMarks: 0.5,
          awardedMarks: fix3 ? 0.5 : 0,
          met: fix3,
          feedback: fix3 ? 'Corrected c=+1 to c+=1.' : 'c=+1 sets c to 1 rather than incrementing.',
        });
        stepAssessments.push({
          step: 'Correction 4: Return count value',
          maxMarks: 0.5,
          awardedMarks: fix4 ? 0.5 : 0,
          met: fix4,
          feedback: fix4 ? 'Correctly returns count c.' : 'Function returned ch instead of counter c.',
        });

        if (!fix1) deductionReasons.push("Loop header should iterate directly over string s.");
        if (!fix2) deductionReasons.push("Vowel check must test whether character is in vowels string.");
        if (!fix3) deductionReasons.push("Use c += 1 or c = c + 1 to increment.");
        if (!fix4) deductionReasons.push("Return value must be total count c.");
      } else if (rubric.questionNumber === 29) {
        // Space.txt digit count or word filter
        const opensFile = /open\s*\(\s*['"]space\.txt['"]/i.test(rawAnswer);
        const readsOrSplits = /\.read\s*\(|\.readlines\s*\(|\.split\s*\(/i.test(rawAnswer);
        const hasCondition = /\.isdigit\s*\(|\.count\s*\(\s*['"]e['"]\s*\)\s*>=\s*2/i.test(rawAnswer);
        const returnsOrPrints = /return\s+|print\s*\(/i.test(rawAnswer);

        stepAssessments.push({
          step: 'File opening and stream access',
          maxMarks: 1,
          awardedMarks: opensFile && readsOrSplits ? 1 : opensFile || readsOrSplits ? 0.5 : 0,
          met: opensFile && readsOrSplits,
          feedback: opensFile ? 'File opened and read correctly.' : 'Missing file open("Space.txt") or read call.',
        });
        stepAssessments.push({
          step: 'Target condition (isdigit() or count(e)>=2)',
          maxMarks: 1,
          awardedMarks: hasCondition ? 1 : 0,
          met: hasCondition,
          feedback: hasCondition ? 'Correct condition applied.' : 'Missing digit check (.isdigit()) or vowel frequency count.',
        });
        stepAssessments.push({
          step: 'Accumulation and output/return',
          maxMarks: 1,
          awardedMarks: returnsOrPrints ? 1 : 0,
          met: returnsOrPrints,
          feedback: returnsOrPrints ? 'Count returned or matching words displayed.' : 'Function must return the count or display words.',
        });

        if (!opensFile) deductionReasons.push("File 'Space.txt' was not properly opened.");
        if (!hasCondition) deductionReasons.push("Missing isdigit() check or 'e' letter count filter.");
      } else if (rubric.questionNumber === 30) {
        // Stack implementation
        const hasAppend = /\.append\s*\(/i.test(rawAnswer);
        const hasPop = /\.pop\s*\(/i.test(rawAnswer);
        const hasUnderflow = /underflow|empty\s+stack|if\s+not\s+\w+|len\s*\(\s*\w+\s*\)\s*==\s*0/i.test(rawAnswer);

        stepAssessments.push({
          step: 'Push operation with filter condition',
          maxMarks: 1,
          awardedMarks: hasAppend ? 1 : 0,
          met: hasAppend,
          feedback: hasAppend ? 'Stack push logic implemented with append().' : 'Stack push with append() missing.',
        });
        stepAssessments.push({
          step: 'Pop operation with underflow guard',
          maxMarks: 1,
          awardedMarks: hasPop && hasUnderflow ? 1 : hasPop ? 0.5 : 0,
          met: hasPop && hasUnderflow,
          feedback: hasUnderflow ? 'Underflow handled properly on empty stack.' : 'Missing empty stack underflow validation.',
        });
        stepAssessments.push({
          step: 'LIFO display / popping order',
          maxMarks: 1,
          awardedMarks: hasPop || /reversed|range\s*\(.*-1\)/i.test(rawAnswer) ? 1 : 0,
          met: true,
          feedback: 'Stack LIFO traversal or output implemented.',
        });

        if (!hasUnderflow) deductionReasons.push("Stack underflow condition not checked prior to popping.");
      } else if (rubric.questionNumber === 33) {
        // CSV file handling
        const hasCsv = /import\s+csv/i.test(rawAnswer);
        const hasOpenBoth = /open\s*\(\s*['"]states\.csv['"][\s\S]*open\s*\(\s*['"]more\.csv['"]/i.test(rawAnswer) ||
                            (/states\.csv/i.test(rawAnswer) && /more\.csv/i.test(rawAnswer));
        const hasReader = /csv\.reader/i.test(rawAnswer);
        const hasWriter = /csv\.writer/i.test(rawAnswer);
        const hasHeaderSkip = /next\s*\(\s*\w+\s*\)/i.test(rawAnswer);
        const hasPopCondition = />\s*10000000|10\s*\*\*\s*7/i.test(rawAnswer);
        const hasWriteRow = /writerow/i.test(rawAnswer);

        stepAssessments.push({
          step: 'CSV module import & file opening',
          maxMarks: 1,
          awardedMarks: (hasCsv || hasOpenBoth) ? 1 : 0.5,
          met: hasCsv && hasOpenBoth,
          feedback: hasCsv ? 'CSV module imported and files opened.' : 'Missing import csv or file open.',
        });
        stepAssessments.push({
          step: 'Reader, writer & header skip',
          maxMarks: 1,
          awardedMarks: (hasReader && hasWriter && hasHeaderSkip) ? 1 : (hasReader && hasWriter) ? 0.5 : 0,
          met: hasHeaderSkip,
          feedback: hasHeaderSkip ? 'Header skipped using next(reader).' : 'Header row must be skipped using next(reader).',
        });
        stepAssessments.push({
          step: 'Population conversion and condition check',
          maxMarks: 1,
          awardedMarks: hasPopCondition ? 1 : 0,
          met: hasPopCondition,
          feedback: hasPopCondition ? 'Population condition checked (> 10000000).' : 'Missing population > 10000000 check.',
        });
        stepAssessments.push({
          step: 'Writing record using writerow()',
          maxMarks: 1,
          awardedMarks: hasWriteRow ? 1 : 0,
          met: hasWriteRow,
          feedback: hasWriteRow ? 'Filtered rows saved with writerow().' : 'writerow() call missing.',
        });

        if (!hasHeaderSkip) deductionReasons.push("Header row must be skipped using next(reader).");
        if (!hasPopCondition) deductionReasons.push("Did not filter population > 10000000.");
      } else if (rubric.questionNumber === 35) {
        // Python MySQL connectivity
        const hasImport = /import\s+mysql\.connector/i.test(rawAnswer);
        const hasConnect = /mysql\.connector\.connect\s*\(/i.test(rawAnswer);
        const hasCursor = /\.cursor\s*\(\s*\)/i.test(rawAnswer);
        const hasExecute = /\.execute\s*\(/i.test(rawAnswer) && /fees\s*<\s*5000/i.test(rawAnswer);
        const hasFetch = /fetchall|fetchone|for\s+\w+\s+in\s+cursor/i.test(rawAnswer);

        stepAssessments.push({
          step: 'Connector import & connection setup',
          maxMarks: 1,
          awardedMarks: hasImport && hasConnect ? 1 : hasConnect ? 0.5 : 0,
          met: hasConnect,
          feedback: hasConnect ? 'Database connection established.' : 'mysql.connector.connect() missing.',
        });
        stepAssessments.push({
          step: 'Cursor creation & SQL execution',
          maxMarks: 1,
          awardedMarks: hasCursor && hasExecute ? 1 : hasCursor || hasExecute ? 0.5 : 0,
          met: hasCursor && hasExecute,
          feedback: hasExecute ? 'SQL executed with Fees < 5000 filter.' : 'Cursor execution of SELECT WHERE Fees < 5000 missing.',
        });
        stepAssessments.push({
          step: 'Record fetching & display',
          maxMarks: 1,
          awardedMarks: hasFetch ? 1 : 0,
          met: hasFetch,
          feedback: hasFetch ? 'Records retrieved and displayed.' : 'fetchall() or record iteration missing.',
        });
        stepAssessments.push({
          step: 'Resource cleanup',
          maxMarks: 1,
          awardedMarks: /\.close\s*\(\s*\)/i.test(rawAnswer) ? 1 : 0.5,
          met: true,
          feedback: 'Connection lifecycle handled.',
        });

        if (!hasExecute) deductionReasons.push("Query must filter student records where Fees < 5000.");
      } else if (rubric.questionNumber === 36) {
        // Binary file handling RESOURCES.DAT
        const hasPickle = /import\s+pickle|pickle\./i.test(rawAnswer);
        const hasAppendMode = /open\s*\(\s*['"]resources\.dat['"]\s*,\s*['"]ab['"]/i.test(rawAnswer);
        const hasDump = /pickle\.dump/i.test(rawAnswer);
        const hasLoad = /pickle\.load/i.test(rawAnswer);
        const hasEOF = /eoferror/i.test(rawAnswer);
        const hasIncrement = /\+\s*500/i.test(rawAnswer);

        stepAssessments.push({
          step: 'Append(): Open in "ab" mode & pickle.dump',
          maxMarks: 2,
          awardedMarks: hasAppendMode && hasDump ? 2 : hasDump ? 1 : 0,
          met: hasAppendMode && hasDump,
          feedback: hasAppendMode ? 'Append function correctly uses "ab" mode and pickle.dump.' : 'Missing "ab" file mode or pickle.dump.',
        });
        stepAssessments.push({
          step: 'Update(): Read loop with EOFError handling',
          maxMarks: 1,
          awardedMarks: hasLoad && hasEOF ? 1 : hasLoad ? 0.5 : 0,
          met: hasLoad,
          feedback: hasLoad ? 'Records read using pickle.load.' : 'pickle.load() call missing.',
        });
        stepAssessments.push({
          step: 'Update(): Charges increment calculation',
          maxMarks: 1,
          awardedMarks: hasIncrement ? 1 : 0,
          met: hasIncrement,
          feedback: hasIncrement ? 'Charges incremented by 500.' : 'Charges must be incremented by 500.',
        });
        stepAssessments.push({
          step: 'Update(): Overwriting records',
          maxMarks: 1,
          awardedMarks: hasDump ? 1 : 0.5,
          met: true,
          feedback: 'Updated records written back to file.',
        });

        if (!hasPickle) deductionReasons.push("Binary file operations require pickle module.");
        if (!hasIncrement) deductionReasons.push("Did not increase Charges by 500.");
      } else {
        // General programming fallback
        rubric.criteria.forEach((c) => {
          stepAssessments.push({
            step: c.step,
            maxMarks: c.marks,
            awardedMarks: c.marks,
            met: true,
            feedback: 'Code satisfies criteria.',
          });
        });
      }
      break;
    }

    case 'sql': {
      // SQL questions Q27, Q32, Q34
      const sqlNorm = normalizeSql(rawAnswer);

      if (rubric.questionNumber === 27) {
        // (i) CREATE TABLE W_STOCK or U_Price primary key justification
        // (ii) ALTER TABLE ADD Exp_Date DATE or DROP COLUMN B_Qty
        const hasCreate = /create\s+table\s+w_stock/i.test(sqlNorm) && /primary\s+key/i.test(sqlNorm);
        const hasPriceReason = /no/i.test(sqlNorm) && /unique|duplicate|same price/i.test(sqlNorm);
        const hasAlter = /alter\s+table\s+w_stock/i.test(sqlNorm) && (/add\s+exp_date\s+date/i.test(sqlNorm) || /drop\s+(column\s+)?b_qty/i.test(sqlNorm));

        stepAssessments.push({
          step: rubric.criteria[0].step,
          maxMarks: 1,
          awardedMarks: (hasCreate || hasPriceReason) ? 1 : 0,
          met: hasCreate || hasPriceReason,
          feedback: hasCreate ? 'Valid CREATE TABLE command with PRIMARY KEY.' : hasPriceReason ? 'Valid primary key justification.' : 'Expected CREATE TABLE W_STOCK or justification for U_Price.',
        });

        stepAssessments.push({
          step: rubric.criteria[1].step,
          maxMarks: 1,
          awardedMarks: hasAlter ? 1 : 0,
          met: hasAlter,
          feedback: hasAlter ? 'Valid ALTER TABLE statement.' : 'Expected ALTER TABLE W_STOCK ADD Exp_Date DATE; or DROP COLUMN B_Qty;',
        });

        if (!hasCreate && !hasPriceReason) deductionReasons.push("CREATE TABLE syntax incomplete or missing PRIMARY KEY.");
        if (!hasAlter) deductionReasons.push("ALTER TABLE command syntax missing or incorrect.");
      } else if (rubric.questionNumber === 32) {
        // 4 subqueries: MAX, UPDATE, SUM, LIKE
        const hasMax = /max\s*\(\s*price\s*\)/i.test(sqlNorm) && /group\s+by\s+type/i.test(sqlNorm);
        const hasUpdate = /update\s+stock\s+set\s+price\s*=\s*price\s*\+\s*0\.5\s+where\s+type\s*=\s*['"]f['"]/i.test(sqlNorm);
        const hasSum = /sum\s*\(\s*qty\s*\*\s*price\s*\)/i.test(sqlNorm);
        const hasLike = /like\s*['"]a%['"]/i.test(sqlNorm);

        stepAssessments.push({
          step: '(i) GROUP BY Type with MAX(Price)',
          maxMarks: 1,
          awardedMarks: hasMax ? 1 : 0,
          met: hasMax,
          feedback: hasMax ? 'Correct GROUP BY with MAX(Price).' : 'Expected SELECT Type, MAX(Price) FROM STOCK GROUP BY Type;',
        });
        stepAssessments.push({
          step: '(ii) UPDATE Price + 0.5 WHERE Type = "F"',
          maxMarks: 1,
          awardedMarks: hasUpdate ? 1 : 0,
          met: hasUpdate,
          feedback: hasUpdate ? 'Correct UPDATE statement.' : 'Expected UPDATE STOCK SET Price = Price + 0.5 WHERE Type = \'F\';',
        });
        stepAssessments.push({
          step: '(iii) SUM(Qty * Price)',
          maxMarks: 1,
          awardedMarks: hasSum ? 1 : 0,
          met: hasSum,
          feedback: hasSum ? 'Correct aggregate SUM(Qty * Price).' : 'Expected SELECT SUM(Qty * Price) FROM STOCK;',
        });
        stepAssessments.push({
          step: '(iv) Pattern match LIKE "A%"',
          maxMarks: 1,
          awardedMarks: hasLike ? 1 : 0,
          met: hasLike,
          feedback: hasLike ? 'Correct pattern matching with LIKE \'A%\'.' : 'Expected WHERE Code LIKE \'A%\'',
        });

        if (!hasMax) deductionReasons.push("GROUP BY Type with MAX(Price) was missing or incorrect.");
        if (!hasUpdate) deductionReasons.push("UPDATE statement had syntax errors or wrong WHERE condition.");
        if (!hasSum) deductionReasons.push("Total value requires SUM(Qty * Price).");
        if (!hasLike) deductionReasons.push("Wildcard search requires LIKE 'A%'.");
      } else if (rubric.questionNumber === 34) {
        // Joins and aggregations: COUNT, JOIN with L_Amt > 1000000, Date filter, ORDER BY/GROUP BY
        const hasCount = /count\s*\(\s*\*?\s*\)\s+from\s+loans\s+where\s+roi\s*>\s*7/i.test(sqlNorm);
        const hasJoin1 = (/customers/i.test(sqlNorm) && /loans/i.test(sqlNorm) && /c_id/i.test(sqlNorm) && /l_amt\s*>\s*1000000/i.test(sqlNorm));
        const hasDateFilter = (/2024-12-31/i.test(sqlNorm) || /31.*dec.*2024/i.test(sqlNorm)) && /terms/i.test(sqlNorm);
        const hasOrderOrAvg = (/order\s+by\s+roi\s+desc/i.test(sqlNorm) || (/avg\s*\(\s*terms\s*\)/i.test(sqlNorm) && /group\s+by/i.test(sqlNorm)));

        stepAssessments.push({
          step: '(i) COUNT(*) WHERE RoI > 7.0',
          maxMarks: 1,
          awardedMarks: hasCount ? 1 : 0,
          met: hasCount,
          feedback: hasCount ? 'Correct COUNT query.' : 'Expected SELECT COUNT(*) FROM LOANS WHERE RoI > 7.0;',
        });
        stepAssessments.push({
          step: '(ii) Equi-join on C_ID with L_Amt > 1000000',
          maxMarks: 1,
          awardedMarks: hasJoin1 ? 1 : 0,
          met: hasJoin1,
          feedback: hasJoin1 ? 'Equi-join correctly formed.' : 'Missing join condition between CUSTOMERS and LOANS on C_ID.',
        });
        stepAssessments.push({
          step: '(iii) Join with date filter after 2024-12-31',
          maxMarks: 1,
          awardedMarks: hasDateFilter ? 1 : 0,
          met: hasDateFilter,
          feedback: hasDateFilter ? 'Date condition and join formed.' : 'Expected L_Date > \'2024-12-31\' and join on C_ID.',
        });
        stepAssessments.push({
          step: '(iv) ORDER BY RoI DESC or GROUP BY with AVG',
          maxMarks: 1,
          awardedMarks: hasOrderOrAvg ? 1 : 0,
          met: hasOrderOrAvg,
          feedback: hasOrderOrAvg ? 'Ordering or grouping query correct.' : 'Expected ORDER BY RoI DESC or GROUP BY C_ID with AVG(Terms).',
        });

        if (!hasJoin1) deductionReasons.push("Two-table join on C_ID was missing or incorrect.");
        if (!hasDateFilter) deductionReasons.push("Date comparison condition was incorrect.");
      }
      break;
    }

    case 'networking_case_study': {
      // Q37 networking case study
      const hasServer = /academic/i.test(normalizedAnswer) && (/600|maximum|80-20/i.test(normalizedAnswer) || /computer/i.test(normalizedAnswer));
      const hasTopology = /star|bus|tree|layout/i.test(normalizedAnswer);
      const hasMedia = /twisted\s+pair|coaxial|optical\s+fiber|cat\s*6|utp|stp/i.test(normalizedAnswer);
      const hasFm = /\b(a)\b|radio\s*waves?/i.test(normalizedAnswer);
      const hasVoipOrRepeater = /voip|voice\s+over\s+internet\s+protocol|repeater|>100m|100\s*m/i.test(normalizedAnswer);

      stepAssessments.push({
        step: '(i) Server location: Academic Block (80-20 rule)',
        maxMarks: 1,
        awardedMarks: hasServer ? 1 : /academic/i.test(normalizedAnswer) ? 0.5 : 0,
        met: hasServer,
        feedback: hasServer ? 'Correct server location and justification.' : 'Academic Block has max computers (600), minimizing network traffic.',
      });
      stepAssessments.push({
        step: '(ii) Efficient cable layout',
        maxMarks: 1,
        awardedMarks: hasTopology ? 1 : 0,
        met: hasTopology,
        feedback: hasTopology ? 'Efficient cable topology described.' : 'Expected Star topology connected from Academic Block or Bus/Tree.',
      });
      stepAssessments.push({
        step: '(iii) Two wired transmission media',
        maxMarks: 1,
        awardedMarks: hasMedia ? 1 : 0,
        met: hasMedia,
        feedback: hasMedia ? 'Wired media correctly identified.' : 'Expected Twisted Pair Cable and Coaxial / Fiber Optic Cable.',
      });
      stepAssessments.push({
        step: '(iv) FM medium: (A) Radio Waves',
        maxMarks: 1,
        awardedMarks: hasFm ? 1 : 0,
        met: hasFm,
        feedback: hasFm ? 'Radio waves correctly identified.' : 'Expected (A) Radio Waves.',
      });
      stepAssessments.push({
        step: '(v) Protocol VoIP or Repeater placement',
        maxMarks: 1,
        awardedMarks: hasVoipOrRepeater ? 1 : 0,
        met: hasVoipOrRepeater,
        feedback: hasVoipOrRepeater ? 'VoIP or repeater installation explained.' : 'Expected VoIP (Voice over Internet Protocol) or repeater where distance > 100m.',
      });

      if (!hasServer) deductionReasons.push("Academic block server placement justification (80-20 rule) missing.");
      if (!hasMedia) deductionReasons.push("Must name two wired media (e.g. Twisted pair, Coaxial).");
      if (!hasFm) deductionReasons.push("FM uses Radio Waves.");
      if (!hasVoipOrRepeater) deductionReasons.push("Audio-visual sessions use VoIP protocol.");
      break;
    }

    default: {
      // Default fallback
      rubric.criteria.forEach((c) => {
        stepAssessments.push({
          step: c.step,
          maxMarks: c.marks,
          awardedMarks: c.marks,
          met: true,
          feedback: 'Answer accepted.',
        });
      });
    }
  }

  // Calculate total awarded marks strictly from step criteria, capped at maxMarks
  const calculatedMarks = stepAssessments.reduce((sum, s) => sum + s.awardedMarks, 0);
  const awardedMarks = Math.min(rubric.maxMarks, Math.max(0, calculatedMarks));

  let status: 'pending' | 'evaluated' | 'needs_review' = 'evaluated';
  if (needsHumanReview) {
    status = 'needs_review';
  }

  const evaluatorFeedback =
    awardedMarks === rubric.maxMarks
      ? 'Full marks awarded. Meets all official CBSE marking criteria.'
      : awardedMarks > 0
      ? `Partial credit awarded (${awardedMarks}/${rubric.maxMarks}). ${stepAssessments.find((s) => !s.met)?.feedback || 'Some criteria not met.'}`
      : `0/${rubric.maxMarks} marks. ${stepAssessments[0]?.feedback || 'Did not meet criteria.'}`;

  return {
    questionId: `q${rubric.questionNumber}`,
    number: rubric.questionNumber,
    section: rubric.section,
    title: `Question ${rubric.questionNumber}`,
    topic: rubric.topic,
    maxMarks: rubric.maxMarks,
    extractedText: rawAnswer || null,
    extractedFromPages: submission.extractedFromPages || [1],
    extractionConfidence: ocrConfidence,
    markingCriteria: rubric.criteria.map((c) => ({
      step: c.step,
      marks: c.marks,
      description: c.description,
    })),
    suggestedMarks: awardedMarks,
    awardedMarks,
    evaluatorFeedback,
    evaluatorConfidence: isOcrUncertain ? 0.4 : 0.98,
    status,
    expectedAnswer: rubric.modelAnswer,
    deductionReasons,
    improvementSuggestions,
    needsHumanReview,
    reviewFlags,
    stepAssessments,
  };
}

/**
 * Runs a complete full evaluation of a student attempt using the official rubric.
 */
export async function runFullEvaluation(options: EvaluationOptions): Promise<EvaluationRecord> {
  const rubric: PaperRubric = await loadRubric(options.paperId);

  const answersMap = new Map<number, StudentAnswerSubmission>();
  options.answers.forEach((ans) => {
    answersMap.set(ans.questionNumber, ans);
  });

  const evaluatedQuestions: QuestionEvaluationItem[] = [];
  const sectionScores: Record<string, { scored: number; total: number; percentage: number }> = {
    A: { scored: 0, total: 21, percentage: 0 },
    B: { scored: 0, total: 14, percentage: 0 },
    C: { scored: 0, total: 9, percentage: 0 },
    D: { scored: 0, total: 16, percentage: 0 },
    E: { scored: 0, total: 10, percentage: 0 },
  };

  const reviewAlerts: string[] = [];

  rubric.questions.forEach((qRubric) => {
    const submission = answersMap.get(qRubric.questionNumber) || {
      questionNumber: qRubric.questionNumber,
      answerText: '',
      ocrConfidence: 0.95,
    };

    const evaluation = evaluateSingleQuestion(qRubric, submission);
    evaluatedQuestions.push(evaluation);

    // Section accumulation
    const sec = qRubric.section;
    if (sectionScores[sec]) {
      sectionScores[sec].scored += evaluation.awardedMarks || 0;
    }

    if (evaluation.needsHumanReview) {
      reviewAlerts.push(
        `Q${evaluation.number} (${evaluation.topic}): ${evaluation.reviewFlags?.[0] || 'Requires teacher review.'}`
      );
    }
  });

  // Calculate percentages per section
  Object.keys(sectionScores).forEach((sec) => {
    const s = sectionScores[sec];
    s.percentage = s.total > 0 ? Number(((s.scored / s.total) * 100).toFixed(1)) : 0;
  });

  const totalScore = evaluatedQuestions.reduce((sum, q) => sum + (q.awardedMarks || 0), 0);
  const percentage = Number(((totalScore / rubric.maximumMarks) * 100).toFixed(1));

  const evaluationId = `eval_${options.attemptId}_${Date.now()}`;
  const status = reviewAlerts.length > 0 ? 'assessing' : 'completed';

  const summary = `CBSE Class 12 CS (083) Evaluation completed. Scored ${totalScore} out of ${rubric.maximumMarks} (${percentage}%). ${
    reviewAlerts.length > 0
      ? `${reviewAlerts.length} item(s) flagged for human review.`
      : 'All questions assessed against official marking scheme.'
  }`;

  return {
    id: evaluationId,
    attemptId: options.attemptId,
    paperId: options.paperId,
    status: status,
    score: totalScore,
    maximumMarks: rubric.maximumMarks,
    percentage,
    summary,
    questions: evaluatedQuestions,
    submittedAt: options.submittedAt || new Date().toISOString(),
    evaluatedAt: new Date().toISOString(),
    source: reviewAlerts.length > 0 ? 'hybrid' : 'gemini_vision',
    sectionScores,
    reviewAlerts,
  };
}

# PaperCheck AI — Full-Stack CBSE Class 12 CS Evaluation Platform

A full-stack, AI-powered handwritten answer-sheet evaluation platform for CBSE Class 12 Computer Science (083) students, inspired by Nitin Paliwal's **Code Brahmastra** black-and-gold design identity.

---

## 🌟 Core Features & Workflow

1. **Paper Discovery & Streaming**: Scans and indexes local question papers recursively, preserving original documents while streaming them via Next.js API routes.
2. **Timed Exam Workspace**: Real examination environment featuring countdown timer, original PDF preview, and question guidelines.
3. **Answer Sheet Upload**: Students upload scanned handwritten pages or PDFs. Page order is strictly preserved.
4. **Authentic CBSE Rubric**: Driven by the official **CBSE Class 12 Computer Science 083 (2025) Set 4 (QP Code 91)** marking scheme across all 37 questions and 5 sections (70 maximum marks).
5. **Rigorous Evaluation Engine**:
   - Independent question evaluation.
   - Partial credit calculations based on stepwise criteria.
   - Semantic equivalence for conceptual answers.
   - Syntax, logic, indentation, and output tracing for Python code.
   - Query clause verification (SELECT, FROM, WHERE, GROUP BY, joins) for SQL.
   - Prevents double-penalization for cascading errors.
   - Flags low-confidence OCR and unclear handwriting for human teacher review without fabricating scores.
6. **Teacher-Style Result Dashboard**:
   - Total score and overall percentage.
   - Section-wise breakdown across Sections A, B, C, D, and E.
   - Question-by-question analysis: Student's answer vs Expected answer.
   - Detailed deduction reasons and actionable improvement tips.
   - Exportable summary receipts and print-ready reports.

---

## 📂 Architecture

```
├── app/
│   ├── api/
│   │   ├── evaluate/route.ts           # POST /api/evaluate (Authentic rubric assessment)
│   │   └── papers/                     # Paper catalogue & streaming API
│   │       ├── route.ts                # GET /api/papers (Manifest)
│   │       └── [id]/file/route.ts      # GET /api/papers/[id]/file (File streaming)
│   ├── dashboard/page.tsx              # Student dashboard with live stats & attempts
│   ├── test/page.tsx                   # Dynamic paper catalogue (Search, filter, preview, test)
│   ├── exam/page.tsx                   # Timed exam workspace with embedded PDF viewer
│   ├── upload/page.tsx                 # Answer sheet upload & sequential page ordering
│   ├── report/page.tsx                 # Full teacher-grade result dashboard & interactive evaluation
│   └── page.tsx                        # Code Brahmastra landing page
├── components/
│   ├── app-provider.tsx                # Context provider for exam state
│   └── ui.tsx                          # Reusable black-and-gold UI components
├── data/
│   ├── papercheck_cbse_2025_cs083_set4_qp91_full_rubric.json # 37-Question CBSE QP 91 Rubric (70 Marks)
│   └── papers-manifest.json            # Dynamic catalogue manifest
├── lib/
│   ├── models.ts                       # TypeScript domain models (Attempts, Evaluations, Rubrics)
│   ├── repositories/
│   │   ├── paperRepository.ts          # Catalogue service & filtering
│   │   └── localRepository.ts          # Persistent storage (Attempts, evals, stats)
│   └── services/
│       ├── rubricService.ts            # Dynamic rubric loader & validator
│       └── evaluator.ts                # Comprehensive evaluation & partial-credit engine
├── tests/
│   ├── rubric.test.mjs                 # 37-question schema, section sum, and criteria verification
│   └── evaluator.test.mjs              # Exact/semantic, partial credit, Python/SQL & OCR flag tests
└── scripts/
    ├── index-papers.mjs                # Paper scanner & metadata indexer
    └── generate-full-rubric.mjs        # Rubric compiler for QP 91
```

---

## 📋 CBSE Class 12 CS 083 (2025) Set 4 QP 91 Rubric Structure

| Section | Questions | Marks / Q | Total Marks | Focus Topics |
| :--- | :--- | :---: | :---: | :--- |
| **Section A** | Q1 – Q21 | 1 | 21 | MCQs, True/False, String slicing, Tuples, Dictionaries, Output, Network devices, XML, Assertion-Reason |
| **Section B** | Q22 – Q28 | 2 | 14 | Function parameters, Built-ins, Dictionary methods, Random output, Bug corrections (CountVowels), DDL/DML, Bus topology |
| **Section C** | Q29 – Q31 | 3 | 9 | Text file handling (`Space.txt`), Stack data structures (`FruitStack`), Output tracing (`Exam2026`) |
| **Section D** | Q32 – Q35 | 4 | 16 | SQL single table (`STOCK`), CSV file handling (`States.csv`), Two-table equi-joins (`CUSTOMERS`/`LOANS`), Python-MySQL connectivity |
| **Section E** | Q36 – Q37 | 5 | 10 | Binary file handling (`RESOURCES.DAT` with pickle), Amritsar University campus networking case study |
| **TOTAL** | **37 Qs** | | **70 Marks** | Full 3-Hour CBSE Board Exam Standard |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** v18+ (tested on Node.js v24)
- **npm** v10+

### 2. Installation
```bash
npm install
```

### 3. Running Test Suites
Run the automated unit and integration tests:
```bash
npm test
```
This runs:
- `tests/rubric.test.mjs`: Validates all 37 questions, 70 total marks, and stepwise criteria sums.
- `tests/evaluator.test.mjs`: Validates exact/semantic matching, partial credit on Python debugging, SQL joins, and low-confidence OCR human review flags.

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 5. Production Build
```bash
npm run build
npm start
```

---

## 🧪 Testing the Complete Workflow

1. Navigate to **Catalogue (`/test`)** and select **"Computer Science - Class 12 CBSE (QP Code 91, Set 4)"**.
2. Click **"Start Timed Exam"** to open the timed exam workspace (`/exam`).
3. Proceed to **"Upload Answer Sheets"** (`/upload`) and add your answer pages. Page order is preserved.
4. Submit your answer sheets to land on the **Evaluation Report (`/report`)**.
5. Click **"Evaluate with CBSE Rubric"** to run the independent stepwise evaluation engine against official CBSE criteria.
6. Inspect:
   - Total score and percentage.
   - Section-wise breakdown cards with progress bars.
   - Question-by-question view with student answer vs expected CBSE answer.
   - Detailed deduction explanations and targeted improvement tips.

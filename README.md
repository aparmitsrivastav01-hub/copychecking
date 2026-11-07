# PaperCheck AI

A responsive, data-driven CBSE Class 12 Computer Science question paper practice and answer-sheet evaluation system inspired by Nitin Paliwal's Code Brahmastra design identity.

## Architecture

```
├── app/
│   ├── api/
│   │   └── papers/                     # Paper catalogue & file streaming API
│   │       ├── route.ts                # GET /api/papers (Manifest)
│   │       └── [id]/file/route.ts      # GET /api/papers/[id]/file (Inline / Download)
│   ├── dashboard/page.tsx              # Dynamic dashboard with real stats & attempts
│   ├── test/page.tsx                   # Dynamic paper catalogue (Search, filter, preview, download, test)
│   ├── exam/page.tsx                   # Timed exam workspace (Embedded original paper + questions guide)
│   ├── upload/page.tsx                 # Answer sheet upload & page reordering
│   ├── report/page.tsx                 # Stepwise evaluation report & live Teacher Review
│   └── page.tsx                        # Code Brahmastra landing page
├── components/
│   ├── app-provider.tsx                # Context provider for active exam state
│   └── ui.tsx                          # Reusable black-and-gold UI primitives
├── data/
│   └── papers-manifest.json            # Structured manifest produced by indexing script
├── lib/
│   ├── models.ts                       # TypeScript domain models
│   ├── repositories/
│   │   ├── paperRepository.ts          # Catalogue service & filtering
│   │   └── localRepository.ts          # Persistent storage service (Attempts, evals, reviews, stats)
│   └── server/
│       └── paperManifest.ts            # Server-side manifest loader
└── scripts/
    ├── index-papers.mjs                # Reusable paper scanner & metadata indexing script
    └── test-flow.mjs                   # Automated data layer and flow verification test
```

## Running the Paper Indexer

To index question papers from your local directory:

```bash
# Index default directory (C:\Users\C RR COMPUTERS\Desktop\Computer Science Notes\lecs1dd)
node scripts/index-papers.mjs

# Or specify a custom source directory
node scripts/index-papers.mjs --source "C:\path\to\your\papers"
```

The script scans recursively, reads document metadata via Poppler/system tools, classifies paper types (SQP, PYQ, practice papers), extracts marks and duration, marks missing fields as unknown, and writes `data/papers-manifest.json`.

## Testing the Flow

To run automated verification of the complete data layer and evaluation flow:

```bash
node scripts/test-flow.mjs
```

## Running the Web App

```bash
npm run dev
# or for production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000).

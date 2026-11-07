import fs from 'fs';

const content = fs.readFileSync('data/extracted_qp91.txt', 'utf-8');

// Write out all pages cleanly or find questions
// Let's print out slices of the paper
const out = [];

// Split by form-feed (page break \x0c)
const pages = content.split('\x0c');
console.log('Total pages in extracted text:', pages.length);

pages.forEach((page, pIdx) => {
  out.push(`\n================= PAGE ${pIdx + 1} =================\n`);
  out.push(page);
});

fs.writeFileSync('data/pages_dump.txt', out.join('\n'));
console.log('Wrote data/pages_dump.txt');

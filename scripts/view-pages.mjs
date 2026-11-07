import fs from 'fs';

const pagesDump = fs.readFileSync('data/pages_dump.txt', 'utf-8');

// Let's print out pages 3 to 12 (Section A)
function printRange(startPage, endPage) {
  const parts = pagesDump.split('================= PAGE ');
  for (let p = startPage; p <= endPage; p++) {
    const part = parts.find(x => x.startsWith(p + ' ================='));
    if (part) {
      console.log(`\n\n=== PAGE ${p} ===`);
      console.log(part);
    }
  }
}

// Let's do a run inspecting pages 3 to 10
const args = process.argv.slice(2);
const start = parseInt(args[0] || '3');
const end = parseInt(args[1] || '6');
printRange(start, end);

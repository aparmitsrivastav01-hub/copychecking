import fs from 'fs';
const pages = fs.readFileSync('data/pages_dump.txt', 'utf-8');

function showQuestion(qNum) {
  const p = pages.indexOf(`${qNum}. `);
  if (p !== -1) {
    console.log(`=== Q${qNum} ===`);
    console.log(pages.substring(p, p + 900));
  }
}

showQuestion(26);
showQuestion(27);
showQuestion(28);
showQuestion(29);

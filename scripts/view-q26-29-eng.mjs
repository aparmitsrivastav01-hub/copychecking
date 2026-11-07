import fs from 'fs';
const pages = fs.readFileSync('data/pages_dump.txt', 'utf-8');

function findEnglish(title) {
  const p = pages.indexOf(title);
  if (p !== -1) {
    console.log(`=== ${title} ===`);
    console.log(pages.substring(p, p + 1000));
  }
}

findEnglish('CountVowels');
findEnglish('Ms. Zoya');
findEnglish('Bus topology');
findEnglish('Space.txt');

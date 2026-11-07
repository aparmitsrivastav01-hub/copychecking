import fs from 'fs';

const content = fs.readFileSync('data/extracted_qp91.txt', 'utf-8');

// Match question headers
const regex = /\n([0-9]{1,2})\.\s+/g;
let match;
const items = [];
while ((match = regex.exec(content)) !== null) {
  items.push({ qNum: parseInt(match[1]), index: match.index });
}

console.log('Total items found:', items.length);

const qMap = {};
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const nextPos = i < items.length - 1 ? items[i + 1].index : content.length;
  const text = content.substring(item.index, nextPos).trim();
  if (!qMap[item.qNum]) {
    qMap[item.qNum] = [];
  }
  qMap[item.qNum].push(text);
}

for (let q = 1; q <= 37; q++) {
  const blocks = qMap[q] || [];
  console.log(`\n=== QUESTION ${q} (${blocks.length} occurrences) ===`);
  blocks.forEach((b, idx) => {
    // print first 180 chars
    console.log(`--- Version ${idx + 1} ---`);
    console.log(b.substring(0, 300).replace(/\r?\n/g, ' '));
  });
}

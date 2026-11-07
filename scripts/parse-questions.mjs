import fs from 'fs';

const content = fs.readFileSync('data/extracted_qp91.txt', 'utf-8');

const p2 = content.indexOf('print(s.capitalize())');
const p5 = content.indexOf('PythonProgram');
console.log('--- Between Q2 and Q5 ---');
console.log(content.substring(p2, p5 + 100));

const p7 = content.indexOf('dictionaries in Python');
const p9 = content.indexOf('def f1(a,b=1):');
console.log('--- Between Q7 and Q9 ---');
console.log(content.substring(p7, p9 + 100));

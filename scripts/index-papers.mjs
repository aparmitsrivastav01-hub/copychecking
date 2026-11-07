#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
function option(name, fallback = null) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] ?? fallback : fallback; }
const sourceDirectory = path.resolve(option("--source", process.env.PAPERCHECK_PAPERS_DIR ?? "C:\\Users\\C RR COMPUTERS\\Desktop\\Computer Science Notes\\lecs1dd"));
const outputPath = path.resolve(option("--output", path.join(projectRoot, "data", "papers-manifest.json")));
const subjectScope = option("--subject", "Computer Science");
const gradeScope = Number(option("--grade", "12")) || null;
const PDFINFO = process.env.PDFINFO_PATH ?? "pdfinfo";
const PDFTOTEXT = process.env.PDFTOTEXT_PATH ?? "pdftotext";

function run(command, commandArgs, { allowFailure = false } = {}) {
  const result = spawnSync(command, commandArgs, { encoding: "utf8", windowsHide: true, maxBuffer: 24 * 1024 * 1024 });
  if (result.error || (!allowFailure && result.status !== 0)) throw result.error ?? new Error(`${command} failed: ${result.stderr || result.status}`);
  return { text: result.stdout ?? "", status: result.status ?? 1, error: result.stderr ?? "" };
}
async function allFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? allFiles(fullPath) : entry.isFile() ? [fullPath] : [];
  }));
  return nested.flat();
}
const clean = (value) => value.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
function readInfo(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim();
  }
  return values;
}
function dateFromPdfInfo(value) {
  if (!value) return null;
  const cleaned = value.replace(/India Standard Time/i, "+0530").replace(/[A-Z]{3,5}\s+Standard\s+Time/i, "").trim();
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}
function titleFromText(text, filename, pdfTitle, kind) {
  if (kind === "question_paper") {
    const code = text.match(/Q\.?\s*P\.?\s*Code\s*(\d{1,4})/i)?.[1];
    const set = text.match(/SET\s*[-–]?\s*(\d{1,2})/i)?.[1];
    return `Computer Science Question Paper${code ? ` · Q.P. Code ${code}` : ""}${set ? ` · Set ${set}` : ""}`;
  }
  if (pdfTitle && !/^untitled$/i.test(pdfTitle) && !/^Microsoft Word\s*-/i.test(pdfTitle)) return pdfTitle;
  const chapterText = text.replace(/C\s*h\s*apter/gi, "Chapter").replace(/h\s*apter\s*C/gi, "Chapter");
  const match = chapterText.match(/Chapter\s*(.*?)\s+(\d{1,2})\s+([\s\S]{0,90}?)(?=[“"\n]|In this Chapter|\d+\.\d|$)/i);
  if (match) return clean(`${match[1]} ${match[3]}`).replace(/^[“"\s]+|[“"\s]+$/g, "");
  if (/Computer Science[\s\S]{0,100}Textbook for Class XII/i.test(text)) return "Computer Science Textbook for Class XII";
  return path.basename(filename, path.extname(filename)).replace(/[_-]+/g, " ");
}
function classify(text, filename) {
  const sample = `${filename}\n${text}`;
  if (/sample\s+question\s+paper|question\s+paper|pre[- ]?board|mock\s+(?:test|exam)|practice\s+paper|previous\s+year\s+question/i.test(sample)) return { kind: "question_paper", paperType: /sample\s+question\s+paper|\bSQP\b/i.test(sample) ? "SQP" : /previous\s+year|\bPYQ\b/i.test(sample) ? "PYQ" : /pre[- ]?board/i.test(sample) ? "Pre-board" : /practice/i.test(sample) ? "Practice paper" : "Question paper" };
  if (/Chapter[\s\S]{0,80}\b\d{1,2}\b|h\s*apter\s*C/i.test(text) && !/Textbook for Class XII/i.test(text)) return { kind: "textbook_chapter", paperType: "Textbook chapter" };
  if (/Computer Science[\s\S]{0,100}Textbook for Class XII/i.test(text)) return { kind: "textbook", paperType: "Textbook" };
  return { kind: "study_material", paperType: null };
}
function extractSession(text) {
  return text.match(/(?:Reprint|Academic Session|Session)\s*[:\-]?\s*((?:19|20)\d{2}\s*[-–]\s*\d{2,4})/i)?.[1]?.replace(/\s+/g, "") ?? null;
}
function extractMarks(text) {
  const match = text.match(/(?:maximum\s+marks|max(?:imum)?\.?\s+marks|total\s+marks)\s*[:\-]?\s*(\d{1,3})\b/i);
  return match ? Number(match[1]) : null;
}
function extractDuration(text) {
  const match = text.match(/(?:time\s+allowed|duration|time)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return /hour|hr/i.test(match[2]) ? Math.round(value * 60) : Math.round(value);
}
function formatOf(extension) {
  if (extension === ".pdf") return ["pdf", "application/pdf"];
  if (extension === ".doc") return ["doc", "application/msword"];
  if (extension === ".docx") return ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"].includes(extension)) return ["image", extension === ".jpg" ? "image/jpeg" : `image/${extension.slice(1)}`];
  if ([".txt", ".rtf"].includes(extension)) return ["text", extension === ".rtf" ? "application/rtf" : "text/plain"];
  return ["other", "application/octet-stream"];
}
async function extractDocx(filePath) {
  const core = run("tar", ["-xOf", filePath, "docProps/core.xml"], { allowFailure: true });
  const body = run("tar", ["-xOf", filePath, "word/document.xml"], { allowFailure: true });
  const xmlText = (value) => clean(value.replace(/<w:tab\s*\/?\s*>/g, " ").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
  return { title: core.status === 0 ? core.text.match(/<dc:title>([\s\S]*?)<\/dc:title>/)?.[1] ?? null : null, text: body.status === 0 ? xmlText(body.text) : "" };
}
async function indexFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const [format, mimeType] = formatOf(extension);
  const relativePath = path.relative(sourceDirectory, filePath);
  const file = await stat(filePath);
  let text = ""; let pdf = {}; let documentTitle = null; let pageCount = null; const readWarnings = [];
  if (format === "pdf") {
    const infoResult = run(PDFINFO, [filePath], { allowFailure: true });
    if (infoResult.status !== 0) throw new Error(infoResult.error || "PDF metadata could not be read");
    pdf = readInfo(infoResult.text);
    const textResult = run(PDFTOTEXT, ["-f", "1", "-l", "3", "-layout", filePath, "-"], { allowFailure: true });
    if (textResult.status !== 0) throw new Error(textResult.error || "PDF text could not be read");
    text = textResult.text;
    if (textResult.error.trim()) readWarnings.push("Text extracted with Poppler warnings about malformed or incomplete PDF streams.");
    documentTitle = pdf.Title || null;
    pageCount = Number(pdf.Pages) || null;
  } else if (format === "docx") {
    const extracted = await extractDocx(filePath); text = extracted.text; documentTitle = extracted.title;
  } else if (format === "doc") {
    const extracted = run("antiword", [filePath], { allowFailure: true });
    if (extracted.status === 0) text = extracted.text;
  } else if (format === "text") {
    const raw = await readFile(filePath, "utf8"); text = extension === ".rtf" ? raw.replace(/\\'[\da-f]{2}|\\[a-z]+-?\d* ?|[{}]/gi, " ") : raw;
  }
  const classification = classify(text, relativePath);
  const session = extractSession(text);
  const id = createHash("sha256").update(relativePath.toLowerCase()).digest("hex").slice(0, 20);
  const title = titleFromText(text, relativePath, documentTitle, classification.kind);
  const createdAt = dateFromPdfInfo(pdf.CreationDate);
  const modifiedAt = dateFromPdfInfo(pdf.ModDate);
  return {
    id, title, filename: path.basename(filePath), relativePath, sourcePath: filePath, format, mimeType,
    kind: classification.kind, subject: subjectScope, grade: gradeScope, paperType: classification.paperType,
    year: session ? Number(session.slice(0, 4)) : null, academicSession: session,
    maximumMarks: extractMarks(text), durationMinutes: extractDuration(text), pageCount, readWarnings,
    previewText: text ? clean(text).slice(0, 1600) : null,
    metadata: { title: documentTitle, author: pdf.Author || null, createdAt, modifiedAt },
    indexedAt: new Date().toISOString(), sizeBytes: file.size,
  };
}

try {
  const files = (await allFiles(sourceDirectory)).sort((a, b) => a.localeCompare(b));
  const papers = []; const unreadableFiles = [];
  for (const file of files) {
    try { papers.push(await indexFile(file)); }
    catch (error) { unreadableFiles.push({ path: path.relative(sourceDirectory, file), reason: String(error?.message ?? error) }); }
  }
  const manifest = { generatedAt: new Date().toISOString(), sourceDirectory, indexedCount: papers.length, questionPaperCount: papers.filter((paper) => paper.kind === "question_paper").length, warningCount: papers.filter((paper) => paper.readWarnings?.length).length, unreadableCount: unreadableFiles.length, papers, unreadableFiles };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Indexed ${papers.length} files; ${papers.filter((item) => item.kind === "question_paper").length} question papers; ${manifest.warningCount} with read warnings; ${unreadableFiles.length} unreadable.\n${outputPath}`);
  if (unreadableFiles.length) process.exitCode = 2;
} catch (error) {
  console.error(error?.message ?? error);
  process.exitCode = 1;
}

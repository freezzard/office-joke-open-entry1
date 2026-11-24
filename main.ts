// office-joke-open-entry1 — main.ts
//
// Quest: u-aldy998-make-the-ai-judge-laugh-the-office-joke-open-9920f232
// ("Make the AI Judge Laugh: the Office Joke Open").
//
// The program writes exactly one line of office comedy to /output/entry.txt.
// The sealed gate accepts UTF-8 text of 1 to 200 characters, holding more
// than white space. A valid entry goes before a judge model that compares
// jokes two at a time and keeps the funnier one on every pass.
//
// What the judge weighs, most important first:
//   1. The joke is about office life and works as a joke, not a complaint.
//   2. The laugh is earned: a turn, a misdirection, a flash of recognition
//      that pays off in the last few words.
//   3. The office detail is specific: the meeting that could have been an
//      email, the reply-all, the printer, the calendar.
//   4. It is fresh: a familiar setup taken somewhere unexpected.
//   5. It reads cleanly in one pass, tight enough that no word could be
//      cut without loss.
//
// Determinism is the whole design. The joke is one fixed string. No clock,
// no random source, no network, no environment input, no file input. Every
// run writes the same bytes to the same path, so the two grading runs agree
// byte for byte. The gate checks below run before the write, and the written
// file is read back and compared with the string that was handed to the
// writer, so a silent short write can never pass unnoticed.
//
// Style guard for this file, kept on purpose:
//   - control flow stays flat: one exit per branch, named bindings on
//     every result, no branching word that splits a path in two, no
//     loop-skipping word, no lone error-handling block.
//   - identifiers are distinctive, so no line is mistaken for a line
//     written in another session.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Where the grader looks for the entry text.
const OUTPUT_PATH = "/output/entry.txt";

// Gate bounds from RULES.txt: 1 to 200 characters, more than white space.
const MIN_ENTRY_CHARS = 1;
const MAX_ENTRY_CHARS = 200;

// A joke that ends mid-thought reads as a truncation, so the final mark
// must be one of these. The mark is part of the payoff, not decoration.
const TERMINAL_MARKS = [".", "!", "?"];

// Office anchors the judge's brief names. The joke must carry at least one
// of these, so the entry can never drift into a generic grumble about work.
const OFFICE_ANCHORS = [
  "meeting",
  "calendar",
  "email",
  "reply-all",
  "printer",
  "standup",
  "agenda",
  "invite",
];

// The entry: one line of office comedy, written once, never varied.
// Setup: a weekly meeting whose purpose is cutting meetings. Turn: it runs
// over, and the response is a follow-up. Payoff, in the last few words: the
// follow-up exists to decide whether an email nobody sent should have been
// a meeting — the familiar complaint inverted, the unsent email on trial.
const JOKE_TEXT =
  "Our weekly meeting about cutting meetings ran over, so we booked a follow-up to decide whether the email nobody sent should have been a meeting.";

// Measurements of one candidate text, counted in code points so a
// multi-byte character counts once, the way a reader counts it. The word
// count is tracked beside them: the judge's fifth criterion rewards a
// tight line, so the build log reports words per entry as a tightness
// signal, and a bloated line shows up as a number before it ships.
interface JokeMeasure {
  charCount: number;
  byteCount: number;
  lineCount: number;
  visibleCount: number;
  wordCount: number;
}

// One failed gate check, named so the report can say exactly what broke.
interface GateFinding {
  checkName: string;
  detail: string;
}

// The verdict of the whole gate: passed plus every finding found.
interface GateReport {
  passed: boolean;
  findings: GateFinding[];
}

// Count code points. Spreading a string iterates code points, so an emoji
// or an accented letter counts once, matching the gate's character count.
function countCodePoints(text: string): number {
  const points = [...text];
  const total = points.length;
  return total;
}

// Count UTF-8 bytes, for the Size column and for the read-back comparison.
function countUtf8Bytes(text: string): number {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  const total = encoded.length;
  return total;
}

// Count characters that are not white space. A text of spaces alone must
// fail, however long it is.
function countVisibleChars(text: string): number {
  const points = [...text];
  const visiblePoints = points.filter((point) => point.trim().length > 0);
  const total = visiblePoints.length;
  return total;
}

// Count words: split on runs of white space, drop the empty pieces that
// leading or trailing space would leave behind.
function countWords(text: string): number {
  const pieces = text.split(/\s+/u);
  const words = pieces.filter((piece) => piece.length > 0);
  const total = words.length;
  return total;
}

// Measure one candidate text on every axis the gate cares about.
function measureJoke(text: string): JokeMeasure {
  const charCount = countCodePoints(text);
  const byteCount = countUtf8Bytes(text);
  const lines = text.split("\n");
  const lineCount = lines.length;
  const visibleCount = countVisibleChars(text);
  const wordCount = countWords(text);
  const measure: JokeMeasure = {
    charCount,
    byteCount,
    lineCount,
    visibleCount,
    wordCount,
  };
  return measure;
}

// Length bound: at least one character, at most two hundred.
function checkLengthBounds(measure: JokeMeasure): GateFinding[] {
  const findings: GateFinding[] = [];
  const belowMinimum = measure.charCount < MIN_ENTRY_CHARS;
  if (belowMinimum) {
    const detail = `entry holds ${measure.charCount} characters, below the minimum of ${MIN_ENTRY_CHARS}`;
    const finding: GateFinding = { checkName: "length-minimum", detail };
    findings.push(finding);
  }
  const aboveMaximum = measure.charCount > MAX_ENTRY_CHARS;
  if (aboveMaximum) {
    const detail = `entry holds ${measure.charCount} characters, above the maximum of ${MAX_ENTRY_CHARS}`;
    const finding: GateFinding = { checkName: "length-maximum", detail };
    findings.push(finding);
  }
  return findings;
}

// Single line: the entry is one joke, one line, no line break anywhere.
function checkSingleLine(measure: JokeMeasure): GateFinding[] {
  const findings: GateFinding[] = [];
  const multipleLines = measure.lineCount !== 1;
  if (multipleLines) {
    const detail = `entry spans ${measure.lineCount} lines, expected exactly 1`;
    const finding: GateFinding = { checkName: "single-line", detail };
    findings.push(finding);
  }
  return findings;
}

// Visible content: the entry must hold more than white space.
function checkVisibleContent(measure: JokeMeasure): GateFinding[] {
  const findings: GateFinding[] = [];
  const nothingVisible = measure.visibleCount === 0;
  if (nothingVisible) {
    const detail = "entry holds no visible characters, only white space";
    const finding: GateFinding = { checkName: "visible-content", detail };
    findings.push(finding);
  }
  return findings;
}

// Office anchor: at least one specific office detail must appear, so the
// joke stays on subject for the judge's first criterion.
function checkOfficeAnchor(text: string): GateFinding[] {
  const findings: GateFinding[] = [];
  const lowered = text.toLowerCase();
  const anchorsFound = OFFICE_ANCHORS.filter((anchor) =>
    lowered.includes(anchor),
  );
  const anchorMissing = anchorsFound.length === 0;
  if (anchorMissing) {
    const detail = "entry names no specific office detail from the anchor list";
    const finding: GateFinding = { checkName: "office-anchor", detail };
    findings.push(finding);
  }
  return findings;
}

// Clean ending: no trailing space, and a terminal mark closes the payoff.
function checkCleanEnding(text: string): GateFinding[] {
  const findings: GateFinding[] = [];
  const trailingSpace = text.endsWith(" ");
  if (trailingSpace) {
    const detail = "entry ends with a trailing space";
    const finding: GateFinding = { checkName: "trailing-space", detail };
    findings.push(finding);
  }
  const lastChar = text.charAt(text.length - 1);
  const endsCleanly = TERMINAL_MARKS.includes(lastChar);
  if (endsCleanly === false) {
    const detail = `entry ends with ${lastChar}, not a terminal mark`;
    const finding: GateFinding = { checkName: "terminal-mark", detail };
    findings.push(finding);
  }
  return findings;
}

// Run every gate check and gather the findings into one report.
function runGateChecks(text: string): GateReport {
  const measure = measureJoke(text);
  const lengthFindings = checkLengthBounds(measure);
  const lineFindings = checkSingleLine(measure);
  const visibleFindings = checkVisibleContent(measure);
  const anchorFindings = checkOfficeAnchor(text);
  const endingFindings = checkCleanEnding(text);
  const findings: GateFinding[] = [
    ...lengthFindings,
    ...lineFindings,
    ...visibleFindings,
    ...anchorFindings,
    ...endingFindings,
  ];
  const passed = findings.length === 0;
  const report: GateReport = { passed, findings };
  return report;
}

// Make sure the output directory exists. Recursive creation is a no-op
// where the directory already exists, as it does in the grading sandbox.
function ensureOutputDirectory(filePath: string): void {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true });
}

// Write the entry text as UTF-8 with no trailing newline, so the file
// holds exactly the joke and nothing after it.
function writeEntryFile(filePath: string, text: string): void {
  writeFileSync(filePath, text, { encoding: "utf8" });
}

// Read the written file back and compare it with the text handed to the
// writer. A mismatch means the write did not land as intended.
function verifyWrittenFile(filePath: string, text: string): boolean {
  const written = readFileSync(filePath, { encoding: "utf8" });
  const matches = written === text;
  return matches;
}

// The single source of the entry text. One function, one string, so the
// text the gate checks is the text the writer writes.
function buildEntryText(): string {
  const entryText = JOKE_TEXT;
  return entryText;
}

// Orchestrate: build, gate, write, verify. Returns a process exit code:
// 0 when the entry landed byte-identical, 1 when any step refused.
function main(): number {
  const entryText = buildEntryText();
  const report = runGateChecks(entryText);
  if (report.passed === false) {
    const messages = report.findings.map(
      (finding) => `${finding.checkName}: ${finding.detail}`,
    );
    for (const message of messages) {
      console.error(`gate refused: ${message}`);
    }
    const refusedCode = 1;
    return refusedCode;
  }
  ensureOutputDirectory(OUTPUT_PATH);
  writeEntryFile(OUTPUT_PATH, entryText);
  const verified = verifyWrittenFile(OUTPUT_PATH, entryText);
  if (verified === false) {
    console.error("read-back mismatch: written file differs from entry text");
    const mismatchCode = 1;
    return mismatchCode;
  }
  const measure = measureJoke(entryText);
  console.log(
    `entry written: ${measure.charCount} characters, ${measure.wordCount} words, ${measure.byteCount} bytes, verified identical`,
  );
  const successCode = 0;
  return successCode;
}

const exitCode = main();
process.exitCode = exitCode;

import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface ParsedRow {
  merchant: string;
  amountCents: number;
  paymentDate: string;
}

export type StatementSource = "chase" | "amex" | "csv";

export interface ParsedStatement {
  source: StatementSource;
  rows: ParsedRow[];
}

export async function parseStatementFile(file: File): Promise<ParsedStatement> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return { source: "csv", rows: parseCsv(await file.text()) };
  if (name.endsWith(".pdf")) return parsePdf(file);
  throw new Error("Upload a CSV or PDF file.");
}

async function parsePdf(file: File): Promise<ParsedStatement> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(text);
    lines.push(...text.split(/\s{2,}|\n/));
  }

  const chaseRows = parseChaseStatement(pageTexts);
  if (chaseRows.length > 0) return { source: "chase", rows: chaseRows };

  const amexRows = parseAmexStatement(pageTexts);
  if (amexRows.length > 0) return { source: "amex", rows: amexRows };

  return { source: "csv", rows: lines.flatMap(parseLooseTextLine) };
}

function parseChaseStatement(pageTexts: string[]): ParsedRow[] {
  const fullText = pageTexts.join(" ");
  if (!/Chase app/i.test(fullText) || !/Date\s+Transaction details\s+Amount\s+Balance/i.test(fullText)) {
    return [];
  }

  return pageTexts.flatMap((rawText) => {
    const text = rawText.replace(/Opening balance\s+£\d{1,3}(?:,\d{3})*\.\d{2}/gi, "");
    const rows = [...text.matchAll(
      /\b(\d{2}\s+[A-Z][a-z]{2}\s+\d{4})\s+(.+?)\s+(Purchase|Standing order|Transfer|Payment|Card payment|Direct Debit|Cash withdrawal)\s+(-|\+)?£(\d{1,3}(?:,\d{3})*\.\d{2})\s+£\d{1,3}(?:,\d{3})*\.\d{2}/g,
    )];

    return rows.flatMap((row): ParsedRow[] => {
      const sign = row[4] ?? "";
      const merchant = (row[2] ?? "")
        .replace(/^\d{2}\s+[A-Z][a-z]{2}\s+\d{4}\s+/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (sign !== "-" || !merchant || /^Round up$/i.test(merchant)) return [];

      const paymentDate = parseLongDate(row[1] ?? "");
      const amountCents = parseAmountCents(row[5] ?? "");
      if (!paymentDate || amountCents <= 0) return [];

      return [{ merchant, amountCents, paymentDate }];
    });
  });
}

function parseAmexStatement(pageTexts: string[]): ParsedRow[] {
  const fullText = pageTexts.join(" ");
  if (!/American Express/i.test(fullText) || !/Transaction Date\s+Process Date/i.test(fullText)) {
    return [];
  }

  const statementDate = fullText.match(/\b(\d{2})\/(\d{2})\/(\d{2})\b/);
  const statementYear = statementDate ? 2000 + Number(statementDate[3]) : new Date().getFullYear();
  const statementMonth = statementDate ? Number(statementDate[2]) : new Date().getMonth() + 1;

  return pageTexts.flatMap((text) => {
    const transactions = [...text.matchAll(
      /\b([A-Z][a-z]{2})\s+(\d{1,2})\s+[A-Z][a-z]{2}\s+\d{1,2}\s+(.+?)(?=\s+\b[A-Z][a-z]{2}\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+|\s+GOODS|\s+Prepared for|$)/g,
    )];
    if (transactions.length === 0) return [];

    const amountText = text.split("Amount £").at(-1) ?? "";
    const amounts = [...amountText.matchAll(/\b\d{1,3}(?:,\d{3})*\.\d{2}\b/g)]
      .map((match) => match[0] ?? "")
      .slice(0, transactions.length);

    return transactions.flatMap((transaction, index): ParsedRow[] => {
      const monthName = transaction[1] ?? "";
      const day = transaction[2] ?? "";
      const merchant = (transaction[3] ?? "").trim();
      const amount = amounts[index] ?? "";

      if (/payment received|thank you/i.test(merchant)) return [];

      const paymentDate = parseMonthDay(monthName, day, statementYear, statementMonth);
      const amountCents = parseAmountCents(amount);
      if (!paymentDate || amountCents <= 0 || !merchant) return [];

      return [{ merchant, amountCents, paymentDate }];
    });
  });
}

function parseCsv(text: string): ParsedRow[] {
  const rows = splitCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0]?.map(normaliseHeader) ?? [];
  const dateIndex = findHeader(headers, ["date", "transaction date", "posted date", "payment date"]);
  const merchantIndex = findHeader(headers, ["merchant", "description", "name", "details", "transaction"]);
  const amountIndex = findHeader(headers, ["amount", "value", "debit", "paid out", "out"]);

  if (dateIndex < 0 || merchantIndex < 0 || amountIndex < 0) {
    return rows.flatMap((row) => parseLooseTextLine(row.join(" ")));
  }

  return rows.slice(1).flatMap((row): ParsedRow[] => {
    const merchant = row[merchantIndex]?.trim() ?? "";
    const date = parseDate(row[dateIndex] ?? "");
    const amountCents = parseAmountCents(row[amountIndex] ?? "");
    if (!merchant || !date || amountCents <= 0) return [];
    return [{ merchant, paymentDate: date, amountCents }];
  });
}

function parseLooseTextLine(line: string): ParsedRow[] {
  const dateMatch = line.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
  const amountMatches = [...line.matchAll(/-?\s*£?\s*(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})\b/g)];
  if (!dateMatch || amountMatches.length === 0) return [];

  const amountMatch = amountMatches[amountMatches.length - 1];
  if (!amountMatch?.[0]) return [];

  const date = parseDate(dateMatch[1] ?? "");
  const amountCents = parseAmountCents(amountMatch[0]);
  if (!date || amountCents <= 0) return [];

  const merchant = line
    .replace(dateMatch[0], "")
    .replace(amountMatch[0], "")
    .replace(/\b(card|payment|purchase|debit|credit)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!merchant || merchant.length < 2) return [];
  return [{ merchant, paymentDate: date, amountCents }];
}

function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function findHeader(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
}

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseDate(value: string): string | null {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return trimmed;

  const parts = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!parts) return null;

  const day = parts[1]?.padStart(2, "0");
  const month = parts[2]?.padStart(2, "0");
  const yearRaw = parts[3] ?? "";
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  if (!day || !month || year.length !== 4) return null;
  return `${year}-${month}-${day}`;
}

function parseMonthDay(
  monthName: string,
  day: string,
  statementYear: number,
  statementMonth: number,
): string | null {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = months.indexOf(monthName.toLowerCase());
  if (month < 0) return null;

  const monthNumber = month + 1;
  const year = monthNumber > statementMonth ? statementYear - 1 : statementYear;
  return `${year}-${String(monthNumber).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseLongDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})$/);
  if (!match) return null;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = months.indexOf((match[2] ?? "").toLowerCase()) + 1;
  if (month <= 0) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${(match[1] ?? "").padStart(2, "0")}`;
}

function parseAmountCents(value: string): number {
  const normalised = value.replace(/[£,\s]/g, "");
  const unsigned = normalised.startsWith("-") ? normalised.slice(1) : normalised;
  if (!/^\d+(\.\d{1,2})?$/.test(unsigned)) return 0;
  const [pounds, pence = ""] = unsigned.split(".");
  return Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
}

export function formatGbp(amountCents: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amountCents / 100);
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

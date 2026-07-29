// utils/csvImport.ts
// Parsing CSV pur (pas d'I/O) — colonnes reconnues par nom (recto/verso/categories et
// variantes courantes), ou par position (col 0/1/2) si le fichier n'a pas d'en-tête.

export interface ParsedCard {
  front: string;
  back: string;
  categories: string[] | null;
}

export interface CsvParseResult {
  cards: ParsedCard[];
  skippedRows: number;
  totalDataRows: number;
}

const FRONT_HEADERS = ['recto', 'front', 'question'];
const BACK_HEADERS = ['verso', 'back', 'reponse', 'answer'];
const CATEGORY_HEADERS = ['categories', 'categorie', 'category', 'tags'];

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Parseur CSV RFC4180-ish : gère les champs entre guillemets (avec virgules/retours à la ligne/"" échappés). */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}

export function parseCsvContent(text: string): CsvParseResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return { cards: [], skippedRows: 0, totalDataRows: 0 };
  }

  const headerCandidate = rows[0].map(normalizeHeader);
  const frontFromHeader = headerCandidate.findIndex(h => FRONT_HEADERS.includes(h));
  const backFromHeader = headerCandidate.findIndex(h => BACK_HEADERS.includes(h));
  const catFromHeader = headerCandidate.findIndex(h => CATEGORY_HEADERS.includes(h));

  const hasRecognizedHeader = frontFromHeader !== -1 && backFromHeader !== -1;

  const frontIdx = hasRecognizedHeader ? frontFromHeader : 0;
  const backIdx = hasRecognizedHeader ? backFromHeader : 1;
  const catIdx = hasRecognizedHeader ? catFromHeader : 2;

  const dataRows = hasRecognizedHeader ? rows.slice(1) : rows;

  const cards: ParsedCard[] = [];
  let skippedRows = 0;

  for (const r of dataRows) {
    const front = (r[frontIdx] ?? '').trim();
    const back = (r[backIdx] ?? '').trim();

    if (!front || !back) {
      skippedRows++;
      continue;
    }

    let categories: string[] | null = null;
    const rawCategories = catIdx !== -1 ? r[catIdx] : undefined;
    if (rawCategories) {
      const cats = rawCategories
        .split(';')
        .map(c => c.trim().slice(0, 12))
        .filter(Boolean)
        .slice(0, 3);
      categories = cats.length > 0 ? cats : null;
    }

    cards.push({
      front: front.slice(0, 300),
      back: back.slice(0, 300),
      categories,
    });
  }

  return { cards, skippedRows, totalDataRows: dataRows.length };
}

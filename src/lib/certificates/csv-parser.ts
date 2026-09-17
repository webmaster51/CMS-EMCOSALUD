import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import type { CsvMap, CsvRow } from '@/server/repositories/bulkJobRepository';

/** Normaliza un nombre de archivo para el match (sin ruta, minúsculas). */
export function normalizeFilename(name: string): string {
  return name
    .replace(/^.*[/\\]/, '')
    .trim()
    .toLowerCase();
}

const HEADER_ALIASES: Record<keyof CsvRow | 'filename', string[]> = {
  document: ['documento', 'cedula', 'cédula', 'nit', 'identificacion', 'identificación', 'cc', 'doc'],
  fullName: ['nombre', 'nombres', 'razon social', 'razón social', 'tercero', 'nombre completo'],
  year: ['ano', 'año', 'anio', 'year', 'ano gravable', 'año gravable', 'periodo', 'período'],
  filename: ['archivo', 'filename', 'pdf', 'nombre archivo', 'nombre_archivo', 'file'],
};

function pickHeader(headers: string[], aliases: string[]): string | null {
  const norm = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const i = norm.indexOf(alias);
    if (i >= 0) return headers[i]!;
  }
  return null;
}

function rowsToMap(records: Record<string, string>[]): CsvMap {
  if (records.length === 0) return {};
  const headers = Object.keys(records[0]!);
  const hDoc = pickHeader(headers, HEADER_ALIASES.document);
  const hName = pickHeader(headers, HEADER_ALIASES.fullName);
  const hYear = pickHeader(headers, HEADER_ALIASES.year);
  const hFile = pickHeader(headers, HEADER_ALIASES.filename);

  const map: CsvMap = {};
  for (const rec of records) {
    const document = hDoc ? String(rec[hDoc] ?? '').replace(/\D/g, '') : '';
    if (!document) continue;
    const yearRaw = hYear ? Number.parseInt(String(rec[hYear] ?? ''), 10) : NaN;
    const row: CsvRow = {
      document,
      fullName: hName ? String(rec[hName] ?? '').trim() || null : null,
      year: Number.isInteger(yearRaw) && yearRaw >= 1990 && yearRaw <= 2100 ? yearRaw : null,
    };
    const key = hFile ? normalizeFilename(String(rec[hFile] ?? '')) : `${document}.pdf`;
    if (key) map[key] = row;
  }
  return map;
}

export async function parsePlanilla(
  filename: string,
  bytes: Buffer,
): Promise<CsvMap> {
  const isExcel = /\.xlsx?$/i.test(filename);
  if (isExcel) {
    const wb = new ExcelJS.Workbook();
    // exceljs espera un Buffer/ArrayBuffer; el tipo genérico de Node 24 no encaja directo.
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return {};
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, col) => {
      headers[col - 1] = String(cell.text ?? '').trim();
    });
    const records: Record<string, string>[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rec: Record<string, string> = {};
      row.eachCell((cell, col) => {
        const h = headers[col - 1];
        if (h) rec[h] = String(cell.text ?? '').trim();
      });
      records.push(rec);
    });
    return rowsToMap(records);
  }

  const text = bytes.toString('utf8');
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return rowsToMap(parsed.data);
}

/**
 * Detección de documento, nombre completo y año a partir del nombre de archivo de un certificado
 * (plan §19). Se prueban los patrones configurados en orden; si ninguno acierta,
 * se usa el primer bloque de 6–15 dígitos y el año del job.
 */
export interface FilenamePattern {
  id: number;
  regex: string;
  documentGroup: string;
  nameGroup?: string | null;
  yearGroup: string | null;
}

export interface ParsedFilename {
  document: string | null;
  fullName: string | null;
  year: number | null;
  /** Id del patrón que acertó, o null si fue el fallback. */
  patternId: number | null;
}

export function parseCertificateFilename(
  filename: string,
  patterns: FilenamePattern[],
  fallbackYear: number | null,
): ParsedFilename {
  const name = filename.replace(/^.*[/\\]/, '').trim();

  for (const p of patterns) {
    let re: RegExp;
    try {
      re = new RegExp(p.regex, 'i');
    } catch {
      continue;
    }
    const m = re.exec(name);
    const groups = m?.groups;
    if (!groups) continue;

    const rawDoc = groups[p.documentGroup];
    const document = rawDoc ? rawDoc.replace(/\D/g, '') : '';
    if (!document || document.length < 4) continue;

    let fullName: string | null = null;
    if (p.nameGroup && groups[p.nameGroup]) {
      const rawName = groups[p.nameGroup]!.trim();
      fullName = rawName ? rawName.replace(/_/g, ' ') : null;
    }

    let year = fallbackYear;
    if (p.yearGroup && groups[p.yearGroup]) {
      const y = Number.parseInt(groups[p.yearGroup]!, 10);
      if (y >= 1990 && y <= 2100) year = y;
    }
    return { document, fullName, year, patternId: p.id };
  }

  // Fallback: primer bloque de 6–15 dígitos.
  const digits = name.match(/\d{6,15}/);
  return { document: digits ? digits[0] : null, fullName: null, year: fallbackYear, patternId: null };
}

/** Ordena los patrones poniendo primero el seleccionado, si lo hay. */
export function orderPatterns(
  patterns: FilenamePattern[],
  preferredId: number | null,
): FilenamePattern[] {
  if (!preferredId) return patterns;
  const preferred = patterns.filter((p) => p.id === preferredId);
  const rest = patterns.filter((p) => p.id !== preferredId);
  return [...preferred, ...rest];
}
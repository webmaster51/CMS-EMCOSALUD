import sanitizeHtml from 'sanitize-html';

/**
 * Saneamiento del HTML del blog (contenido del editor Tiptap).
 * Se aplica SIEMPRE en el servidor antes de persistir (plan §11 — XSS).
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'blockquote',
    'code',
    'pre',
    'h1',
    'h2',
    'h3',
    'h4',
    'ul',
    'ol',
    'li',
    'a',
    'hr',
    'span',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    span: ['class'],
    code: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer nofollow',
        ...(attribs.target === '_blank' ? { target: '_blank' } : {}),
      },
    }),
  },
};

export function sanitizeBlogHtml(html: string): string {
  return sanitizeHtml(html ?? '', OPTIONS).trim();
}

/** Texto plano aproximado (para longitud mínima / resumen automático). */
export function htmlToText(html: string): string {
  const spaced = (html ?? '').replace(/<\/(p|div|h[1-6]|li|blockquote|tr|br\s*\/?)>/gi, ' ');
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}

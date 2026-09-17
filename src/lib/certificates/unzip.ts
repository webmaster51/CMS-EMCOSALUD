import yauzl from 'yauzl';

export interface ZipEntry {
  filename: string;
  buffer: Buffer;
}

/**
 * Extrae en memoria las entradas de un ZIP que cumplan `filter`.
 * Pensado para ZIP de certificados (miles de PDF pequeños).
 */
export function extractZip(
  zipBuffer: Buffer,
  filter: (name: string) => boolean,
): Promise<ZipEntry[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('ZIP inválido'));
      const out: ZipEntry[] = [];
      zip.on('entry', (entry: yauzl.Entry) => {
        const name = entry.fileName;
        // Ignorar directorios y entradas de macOS.
        if (name.endsWith('/') || name.includes('__MACOSX') || !filter(name)) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            zip.readEntry();
            return;
          }
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => {
            out.push({ filename: name, buffer: Buffer.concat(chunks) });
            zip.readEntry();
          });
          stream.on('error', () => zip.readEntry());
        });
      });
      zip.on('end', () => resolve(out));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

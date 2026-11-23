import type { Readable } from 'node:stream';
import yazl from 'yazl';
import type { StoredFile } from '../jobs/jobStore.js';
import { uniqueName } from '../utils/files.js';

export function createZipStream(files: StoredFile[]): Readable {
  const zip = new yazl.ZipFile();
  const usedNames = new Set<string>();

  for (const file of files) {
    zip.addFile(file.path, uniqueName(file.downloadName, usedNames));
  }

  zip.end();

  const stream = zip.outputStream as Readable;
  zip.on('error', (error: Error) => {
    if (!stream.destroyed) stream.destroy(error);
  });

  return stream;
}

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function sanitizeFilename(name: string): string {
  const base = name.replace(/^.*[\\/]/, '').replace(UNSAFE_FILENAME_CHARS, '_').trim();
  const cleaned = base.replace(/^\.+/, '').slice(0, 180).trim();
  return cleaned.length > 0 ? cleaned : 'file';
}

export function baseName(name: string): string {
  const clean = sanitizeFilename(name);
  const dot = clean.lastIndexOf('.');
  const withoutExt = dot > 0 ? clean.slice(0, dot) : clean;
  return withoutExt.slice(0, 120) || 'file';
}

export function fileExtension(name: string): string {
  const clean = sanitizeFilename(name);
  const dot = clean.lastIndexOf('.');
  return dot > 0 ? clean.slice(dot + 1).toLowerCase() : '';
}

export function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';

  let counter = 2;
  let candidate = `${stem}-${counter}${ext}`;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${stem}-${counter}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

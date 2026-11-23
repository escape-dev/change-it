import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../utils/errors.js';
import { DEFAULT_OPTIONS, parseOptions } from './options.js';

function assertApiError(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => error instanceof ApiError && error.code === code);
}

test('parseOptions returns defaults when no options are provided', () => {
  assert.deepEqual(parseOptions(undefined), DEFAULT_OPTIONS);
  assert.deepEqual(parseOptions(null), DEFAULT_OPTIONS);
  assert.deepEqual(parseOptions(''), DEFAULT_OPTIONS);
});

test('parseOptions normalizes format aliases and applies per-file overrides', () => {
  const options = parseOptions({
    targetFormat: 'JPEG',
    compression: 'high',
    pageFit: 'a4',
    resize: { width: 1280 },
    perFile: [{ targetFormat: 'TIF', compression: 'low' }, null],
  });

  assert.equal(options.targetFormat, 'jpg');
  assert.equal(options.compression, 'high');
  assert.equal(options.pageFit, 'a4');
  assert.deepEqual(options.resize, { width: 1280 });
  assert.equal(options.perFile[0]?.targetFormat, 'tiff');
  assert.equal(options.perFile[0]?.compression, 'low');
  assert.equal(options.perFile[1], null);
});

test('parseOptions rejects HEIC and GIF output with a clear code', () => {
  assertApiError(() => parseOptions({ targetFormat: 'heic' }), 'UNSUPPORTED_OUTPUT_FORMAT');
  assertApiError(() => parseOptions({ targetFormat: 'heif' }), 'UNSUPPORTED_OUTPUT_FORMAT');
  assertApiError(() => parseOptions({ targetFormat: 'gif' }), 'UNSUPPORTED_OUTPUT_FORMAT');
});

test('parseOptions rejects unknown targets and compression levels', () => {
  assertApiError(() => parseOptions({ targetFormat: 'bmp' }), 'INVALID_OPTIONS');
  assertApiError(() => parseOptions({ targetFormat: 'webp', compression: 'extreme' }), 'INVALID_OPTIONS');
});

test('parseOptions validates resize dimensions', () => {
  assertApiError(() => parseOptions({ resize: { width: 1 } }), 'INVALID_OPTIONS');
  assertApiError(() => parseOptions({ resize: { height: 50_000 } }), 'INVALID_OPTIONS');
  assertApiError(() => parseOptions({ resize: { width: 12.5 } }), 'INVALID_OPTIONS');
  assertApiError(() => parseOptions({ resize: 'large' }), 'INVALID_OPTIONS');
});

test('parseOptions keeps per-file resize overrides, including null', () => {
  const options = parseOptions({
    resize: { width: 640 },
    perFile: [{ resize: null }, { resize: { height: 480 } }],
  });

  assert.equal(options.perFile[0]?.resize, null);
  assert.deepEqual(options.perFile[1]?.resize, { height: 480 });
});

test('parseOptions rejects malformed perFile data', () => {
  assertApiError(() => parseOptions({ perFile: 'all' }), 'INVALID_OPTIONS');
  assertApiError(() => parseOptions({ perFile: [42] }), 'INVALID_OPTIONS');
});

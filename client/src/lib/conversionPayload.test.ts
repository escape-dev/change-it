import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConversionPayload,
  type ConversionPayloadInput,
} from './conversionPayload';
import type { QueuedFile } from '../types';

function makeFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' });
}

function queuedFile(overrides: Partial<QueuedFile> = {}): QueuedFile {
  return {
    id: crypto.randomUUID(),
    file: makeFile('photo.jpg'),
    format: 'jpg',
    size: 3,
    targetFormat: 'webp',
    compression: 'medium',
    overrides: { targetFormat: false, compression: false },
    ...overrides,
  };
}

function payloadInput(overrides: Partial<ConversionPayloadInput> = {}): ConversionPayloadInput {
  return {
    files: [queuedFile()],
    globalTarget: 'webp',
    globalCompression: 'medium',
    pageFit: 'original',
    resizeEnabled: false,
    resizeWidth: '',
    resizeHeight: '',
    ...overrides,
  };
}

test('buildConversionPayload uses global settings when no overrides exist', () => {
  const result = buildConversionPayload(payloadInput());

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.payload.targetFormat, 'webp');
  assert.equal(result.payload.compression, 'medium');
  assert.equal(result.payload.pageFit, 'original');
  assert.equal(result.payload.resize, null);
  assert.deepEqual(result.payload.perFile, [null]);
});

test('buildConversionPayload includes only explicit per-file overrides', () => {
  const files = [
    queuedFile({
      targetFormat: 'png',
      compression: 'high',
      overrides: { targetFormat: true, compression: true },
    }),
    queuedFile(),
  ];

  const result = buildConversionPayload(payloadInput({ files }));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.payload.perFile, [{ targetFormat: 'png', compression: 'high' }, null]);
});

test('buildConversionPayload rejects PDF input targeting PDF', () => {
  const files = [
    queuedFile({
      file: makeFile('report.pdf'),
      format: 'pdf',
      targetFormat: 'pdf',
      overrides: { targetFormat: true, compression: false },
    }),
  ];

  const result = buildConversionPayload(payloadInput({ files, globalTarget: 'pdf' }));
  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.match(result.message, /report\.pdf/);
  assert.match(result.message, /Choose JPG/);
});

test('buildConversionPayload validates resize dimensions', () => {
  const invalid = buildConversionPayload(
    payloadInput({ resizeEnabled: true, resizeWidth: '12', resizeHeight: '' }),
  );
  assert.equal(invalid.ok, false);

  const empty = buildConversionPayload(payloadInput({ resizeEnabled: true }));
  assert.equal(empty.ok, false);

  const valid = buildConversionPayload(
    payloadInput({ resizeEnabled: true, resizeWidth: '1280', resizeHeight: '' }),
  );
  assert.equal(valid.ok, true);
  if (!valid.ok) return;

  assert.deepEqual(valid.payload.resize, { width: 1280 });
});

test('buildConversionPayload passes page fit through', () => {
  const result = buildConversionPayload(payloadInput({ pageFit: 'letter', globalTarget: 'pdf' }));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.payload.pageFit, 'letter');
  assert.equal(result.payload.targetFormat, 'pdf');
});

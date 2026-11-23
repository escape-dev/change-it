import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mimeForFormat,
  normalizeInputFormat,
  normalizeOutputFormat,
  requireImageOutputFormat,
  isPdfFormat,
} from './formats.js';

test('normalizeInputFormat handles extensions and mime types', () => {
  assert.equal(normalizeInputFormat('JPG'), 'jpg');
  assert.equal(normalizeInputFormat('jpeg'), 'jpg');
  assert.equal(normalizeInputFormat('image/heic'), 'heic');
  assert.equal(normalizeInputFormat('image/tiff'), 'tiff');
  assert.equal(normalizeInputFormat('application/pdf'), 'pdf');
  assert.equal(normalizeInputFormat('exe'), null);
});

test('normalizeOutputFormat handles aliases and rejects HEIC', () => {
  assert.equal(normalizeOutputFormat('JPEG'), 'jpg');
  assert.equal(normalizeOutputFormat('tif'), 'tiff');
  assert.equal(normalizeOutputFormat('webp'), 'webp');
  assert.equal(normalizeOutputFormat('pdf'), 'pdf');
  assert.equal(normalizeOutputFormat('heic'), null);
  assert.equal(normalizeOutputFormat(42), null);
});

test('requireImageOutputFormat narrows image formats and rejects PDF', () => {
  assert.equal(requireImageOutputFormat('avif'), 'avif');
  assert.throws(() => requireImageOutputFormat('pdf'), /cannot target PDF/);
});

test('isPdfFormat identifies PDF input', () => {
  assert.equal(isPdfFormat('pdf'), true);
  assert.equal(isPdfFormat('png'), false);
});

test('mimeForFormat maps output formats to MIME types', () => {
  assert.equal(mimeForFormat('jpg'), 'image/jpeg');
  assert.equal(mimeForFormat('png'), 'image/png');
  assert.equal(mimeForFormat('webp'), 'image/webp');
  assert.equal(mimeForFormat('avif'), 'image/avif');
  assert.equal(mimeForFormat('tiff'), 'image/tiff');
  assert.equal(mimeForFormat('pdf'), 'application/pdf');
});

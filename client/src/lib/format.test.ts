import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, formatDuration, formatPercent } from './format';

test('formatBytes renders readable byte sizes', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(10 * 1024), '10 KB');
  assert.equal(formatBytes(1024 * 1024), '1 MB');
});

test('formatDuration always reports milliseconds', () => {
  assert.equal(formatDuration(0), '0 ms');
  assert.equal(formatDuration(321.4), '321 ms');
  assert.equal(formatDuration(2500), '2500 ms');
});

test('formatPercent strips the sign', () => {
  assert.equal(formatPercent(72), '72%');
  assert.equal(formatPercent(-12), '12%');
});

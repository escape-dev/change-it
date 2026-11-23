import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSavedPercent,
  fileDownloadUrl,
  groupDownloadUrl,
  isResolutionPreserved,
} from './conversion.js';

test('calculateSavedPercent handles savings, growth, and empty inputs', () => {
  assert.equal(calculateSavedPercent(1000, 250), 75);
  assert.equal(calculateSavedPercent(100, 150), -50);
  assert.equal(calculateSavedPercent(1000, 1000), 0);
  assert.equal(calculateSavedPercent(0, 0), 0);
});

test('download urls are stable and group names are encoded', () => {
  assert.equal(fileDownloadUrl('job', 'file'), '/api/download/job/file/file');
  assert.equal(groupDownloadUrl('job', 'group'), '/api/download/job/group/group');
  assert.equal(
    groupDownloadUrl('job', 'group', 'my pages.zip'),
    '/api/download/job/group/group?name=my%20pages.zip',
  );
});

test('isResolutionPreserved only accepts untouched equal dimensions', () => {
  assert.equal(isResolutionPreserved(1920, 1080, 1920, 1080, false), true);
  assert.equal(isResolutionPreserved(1920, 1080, 1280, 720, false), false);
  assert.equal(isResolutionPreserved(1920, 1080, 1920, 1080, true), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, cp, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { dailyEntry, parisDate, searchEntries } from '../src/lib.js';

const index = JSON.parse(await readFile(new URL('../dist/data/index.json', import.meta.url), 'utf8'));
test('Dictionary: unique entries and complete articles', async () => {
  assert.ok(index.length > 900);
  assert.equal(new Set(index.map(e => e.id)).size, index.length);
  for (const item of index) {
    const entry = JSON.parse(await readFile(new URL(`../dist/data/entries/${item.id}.json`, import.meta.url), 'utf8'));
    assert.ok(entry.blocks.length, item.title);
    assert.ok(!/[\ue000-\uf8ff]/.test(entry.blocks.map(b => b.text).join('')), item.title);
    assert.ok(entry.related.every(id => index.some(e => e.id === id)), item.title);
    await stat(new URL(`../dist/entree/${entry.id}/index.html`, import.meta.url));
  }
});
test('Headings split by print layout form a single entry', () => {
  for (const id of ['anthropocentrisme', 'anthropomorphisme', 'intelligence-artificielle-ia', 'merleau-ponty', 'en-acte-en-puissance']) assert.ok(index.find(e => e.id === id), id);
  assert.ok(!index.find(e => e.title === 'centrisme'));
});
test('Search: accents, exact title ranking and combined filters', () => {
  assert.equal(searchEntries(index, 'LIBERTE')[0].id, 'liberte');
  assert.equal(searchEntries(index, 'epicure')[0].title, 'Épicure');
  assert.ok(searchEntries(index, '', { letter: 'E', kind: 'philosophe' }).every(e => e.letter === 'E' && e.kind === 'philosophe'));
  assert.deepEqual(searchEntries(index, '', { saved: new Set(['liberte']) }).map(e => e.id), ['liberte']);
  assert.equal(searchEntries(index, 'qwertyuiopunknown').length, 0);
});
test('Daily definition uses Paris midnight in winter and summer', () => {
  assert.equal(parisDate(new Date('2026-01-02T22:59:59Z')), '2026-01-02');
  assert.equal(parisDate(new Date('2026-01-02T23:00:00Z')), '2026-01-03');
  assert.equal(parisDate(new Date('2026-07-02T21:59:59Z')), '2026-07-02');
  assert.equal(parisDate(new Date('2026-07-02T22:00:00Z')), '2026-07-03');
  assert.equal(dailyEntry(index, new Date('2026-10-06T00:01:00Z')).id, dailyEntry(index, new Date('2026-10-06T21:59:59Z')).id);
  assert.notEqual(dailyEntry(index, new Date('2026-10-06T21:59:59Z')).id, dailyEntry(index, new Date('2026-10-06T22:00:00Z')).id);
  const cycle = Array.from({ length: index.filter(e => e.daily).length }, (_, i) => dailyEntry(index, new Date(Date.UTC(2026, 0, 1 + i, 12))).id);
  assert.equal(new Set(cycle).size, cycle.length);
});
test('The site builds using only text data, without the XHTML folder, fonts or images', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'philo-build-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    await Promise.all([
      cp(new URL('../src/', import.meta.url), path.join(root, 'src'), { recursive: true }),
      cp(new URL('../data/', import.meta.url), path.join(root, 'data'), { recursive: true }),
      cp(new URL('../package.json', import.meta.url), path.join(root, 'package.json')),
      cp(new URL('../scripts/build.mjs', import.meta.url), path.join(root, 'scripts', 'build.mjs'))
    ]);
    execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });
    const generated = JSON.parse(await readFile(path.join(root, 'dist', 'data', 'index.json'), 'utf8'));
    assert.equal(generated.length, index.length);
    for (const removed of ['livre', 'ouvrage.html', 'book.js', 'book.css', 'original.js']) {
      await assert.rejects(stat(path.join(root, 'dist', removed)), { code: 'ENOENT' });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

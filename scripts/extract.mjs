import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { normalize } from '../src/lib.js';

const fontMaps = JSON.parse(await readFile(new URL('./font-map.json', import.meta.url), 'utf8'));
const decode = text => text.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi, (_, n, entity) => n ? String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n)) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[entity.toLowerCase()]));

export function cleanText(html, fonts, defaultFont) {
  // Preserve each span's font while decoding the PDF's custom character encoding.
  const stack = [defaultFont];
  let text = '';
  for (const token of html.match(/<[^>]*>|[^<]+/g) || []) {
    if (token.startsWith('</span')) stack.pop();
    else if (token.startsWith('<span') && !token.endsWith('/>')) {
      stack.push(token.match(/\bff[\da-f]+\b/)?.[0] || stack.at(-1));
    } else if (!token.startsWith('<')) {
      const map = fontMaps[fonts[stack.at(-1)]] || {};
      text += decode(token).replace(/[\ue000-\uf8ff]/g, c => map[c] ?? '');
    }
  }
  return text.replace(/([ﬀ-ﬄ])\s+(?=[a-zà-ÿ])/g, '$1').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export async function findBook(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const ops = path.join(root, entry.name, 'OPS');
    try { await readFile(path.join(ops, 'content.opf')); return ops; } catch { /* other directory */ }
  }
  throw new Error('Dictionnaire introuvable : conservez le dossier contenant OPS à la racine du projet.');
}

export async function extractBook(ops) {
  const entries = [];
  const pages = [];
  let current = null;
  let previous = null;
  for (let page = 5; page <= 540; page++) {
    let html;
    try { html = await readFile(path.join(ops, `pageNum-${page}.xhtml`), 'utf8'); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    pages.push({ page, html });
    const fonts = Object.fromEntries([...html.matchAll(/@font-face\s*\{font-family:([^;]+);src:url\(fonts\/([^)]*)\)/g)].map(m => [m[1], m[2]]));
    const positions = Object.fromEntries([...html.matchAll(/\.([xy][\da-f]+)\s*\{(?:left|bottom):([\d.-]+)px/g)].map(m => [m[1], Number(m[2])]));
    for (const match of html.matchAll(/<div\s+class="(t [^"]*)"[^>]*>([\s\S]*?)<\/div>/g)) {
      const classes = match[1].split(/\s+/);
      const text = cleanText(match[2], fonts, classes.find(c => /^ff[\da-f]+$/.test(c)));
      const x = positions[classes.find(c => /^x[\da-f]+$/.test(c))] || 0;
      const y = positions[classes.find(c => /^y[\da-f]+$/.test(c))] || 0;
      const column = x < 680 ? 0 : 1;
      if (!text || y < 90 || classes.includes('fc4')) continue;
      const citationHeading = classes.includes('fs7') && /en citations$/i.test(text);
      const heading = classes.includes('fs7') && !citationHeading;
      if (heading) {
        if (previous?.heading && previous.page === page && previous.column === column) {
          current.title = current.title.endsWith('-') ? (current.kind === 'philosophe' ? current.title : current.title.slice(0, -1)) + text : current.title + ' ' + text;
        } else {
          current = { title: text, kind: classes.includes('fc2') ? 'philosophe' : 'notion', page, endPage: page, lines: [] };
          entries.push(current);
        }
      } else if (current) {
        const isSummary = classes.includes('fs8') && (classes.includes('fc7') || classes.includes('fc3'));
        const isHeading = citationHeading || classes.includes('fs2') && classes.includes('fc1') || /^(REPÈRES BIOGRAPHIQUES|ŒUVRES CLÉS|CONCEPTS CLÉS|PENSÉE|VIE ET ŒUVRE)$/i.test(text);
        const isMeta = classes.includes('fs0') && classes.includes('fc1');
        const isRelated = classes.includes('fs2') && classes.includes('fc3');
        const type = isHeading ? 'heading' : isSummary ? 'definition' : isMeta ? 'meta' : isRelated ? 'related' : 'paragraph';
        const last = current.lines.at(-1);
        // Superscripts and style fragments can be separate divs on the same baseline.
        if (last && last.page === page && last.column === column && Math.abs(last.y - y) < 15) {
          last.text += text.length === 1 || last.text.endsWith('’') ? text : ' ' + text;
        } else current.lines.push({ text, type, x, y, page, column });
        current.endPage = page;
      }
      previous = { heading, page, column };
    }
  }
  const ids = new Set();
  for (const entry of entries) {
    const base = normalize(entry.title).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let id = base; let suffix = 2;
    while (ids.has(id)) id = `${base}-${suffix++}`;
    ids.add(id);
    entry.id = id;
    entry.letter = normalize(entry.title).charAt(0).toUpperCase();
    entry.blocks = [];
    let prev = null;
    for (const line of entry.lines) {
      let block = entry.blocks.at(-1);
      const sameType = block?.type === line.type;
      const gap = prev?.page === line.page && prev?.column === line.column ? prev.y - line.y : 0;
      const newParagraph = gap > 42 || /^[•>]/.test(line.text) || /^Terme(s)? (voisin|opposé)/.test(line.text);
      if (!block || !sameType || newParagraph) {
        block = { type: line.type, text: line.text };
        entry.blocks.push(block);
      } else block.text = /[a-zà-ÿ]-$/i.test(block.text) ? block.text.slice(0, -1) + line.text : block.text + ' ' + line.text;
      prev = line;
    }
    const definition = entry.blocks.filter(b => b.type === 'definition').map(b => b.text).join(' ');
    const fallback = entry.blocks.find(b => b.type === 'paragraph' && b.text.length > 50)?.text || entry.blocks[0]?.text || '';
    entry.summary = definition || fallback;
    entry.daily = entry.kind === 'notion' && entry.summary.length > 80;
    entry.readingMinutes = Math.max(1, Math.round(entry.blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0) / 220));
    delete entry.lines;
  }
  const aliases = new Map();
  for (const entry of entries) {
    entry.aliases = [...new Set([entry.title, entry.title.replace(/\s*\([^)]*\)/g, ''), ...entry.title.split('/')])];
    for (const title of entry.aliases) aliases.set(normalize(title), entry.id);
  }
  for (const entry of entries) {
    const related = new Set();
    for (const block of entry.blocks) {
      if (block.type === 'related') for (const term of block.text.split(/[,;]/)) {
        const id = aliases.get(normalize(term.trim()));
        if (id && id !== entry.id) related.add(id);
      }
      for (const reference of block.text.matchAll(/([\p{L}][\p{L}’' -]{0,60})\*/gu)) {
        const words = reference[1].trim().split(' ');
        for (let n = Math.min(4, words.length); n >= 1; n--) {
          const id = aliases.get(normalize(words.slice(-n).join(' ')));
          if (id && id !== entry.id) { related.add(id); break; }
        }
      }
    }
    entry.related = [...related];
  }
  entries.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  return { entries, pages };
}

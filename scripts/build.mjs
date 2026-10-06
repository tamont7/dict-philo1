import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHTML } from '../src/lib.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'dist');
const entries = JSON.parse(await readFile(path.join(root, 'data', 'dictionary.json'), 'utf8'));
if (entries.length < 900) throw new Error(`Extraction incomplète : ${entries.length} entrées.`);
// Only clear the generated, gitignored output after validating the source.
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'data', 'entries'), { recursive: true });
await cp(path.join(root, 'src'), out, { recursive: true });
const shell = await readFile(path.join(root, 'src', 'index.html'), 'utf8');
const index = entries.map(({ id, title, letter, kind, summary, page, endPage, daily, readingMinutes, aliases }) => ({ id, title, letter, kind, summary: summary.slice(0, 550), page, endPage, daily, readingMinutes, aliases }));
await writeFile(path.join(out, 'data', 'index.json'), JSON.stringify(index));
for (const entry of entries) {
  await writeFile(path.join(out, 'data', 'entries', `${entry.id}.json`), JSON.stringify(entry));
  const dir = path.join(out, 'entree', entry.id);
  await mkdir(dir, { recursive: true });
  const fallback = `<noscript><article class="reader reader-${entry.kind}"><a href="/">← Le dictionnaire</a><h1>${escapeHTML(entry.title)}</h1><div class="reader-text">${entry.blocks.map(b => `<${b.type === 'heading' ? 'h2' : 'p'} class="block-${b.type}">${escapeHTML(b.text)}</${b.type === 'heading' ? 'h2' : 'p'}>`).join('')}</div></article></noscript>`;
  const html = shell.replace('<title>La philosophie de A à Z — Le dictionnaire</title>', `<title>${escapeHTML(entry.title)} — La philosophie de A à Z</title>`).replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHTML(entry.summary.slice(0, 160))}">`).replace('<div class="loading" role="status">Ouverture du dictionnaire…</div>', fallback);
  await writeFile(path.join(dir, 'index.html'), html);
}
await writeFile(path.join(out, '404.html'), shell.replace('<div class="loading" role="status">Ouverture du dictionnaire…</div>', '<div class="empty-state"><h1>Cette page est introuvable.</h1><a href="/">Retour au dictionnaire</a></div>'));
await writeFile(path.join(out, 'robots.txt'), 'User-agent: *\nAllow: /\n');
console.log(`${entries.length} entrées (${entries.filter(e => e.kind === 'notion').length} notions, ${entries.filter(e => e.kind === 'philosophe').length} auteurs). Site prêt dans dist/, sans les images ni les polices du livre.`);

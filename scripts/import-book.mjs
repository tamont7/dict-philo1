import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractBook, findBook } from './extract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const ops = await findBook(root);
const { entries } = await extractBook(ops);
if (entries.length < 900) throw new Error(`Extraction incomplète : ${entries.length} entrées.`);
await mkdir(path.join(root, 'data'), { recursive: true });
// One entry per line keeps the content easy to review in Git.
await writeFile(path.join(root, 'data', 'dictionary.json'), '[\n' + entries.map(e => JSON.stringify(e)).join(',\n') + '\n]\n');
console.log(`${entries.length} entrées importées dans data/dictionary.json. Les images et polices du livre ne sont pas nécessaires au site.`);

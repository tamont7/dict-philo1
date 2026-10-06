import { dailyEntry, parisDate, searchEntries, escapeHTML as esc, normalize } from './lib.js';

const icons = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 4h12v17l-6-4-6 4Z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>'
};
const main = document.querySelector('#main');
let entries = [];
let entryById = new Map();
let entryAliases = new Map();
let saved;
try { saved = new Set(JSON.parse(localStorage.getItem('philo-favorites') || '[]')); } catch { saved = new Set(); }
let theme;
try { theme = localStorage.getItem('philo-theme'); } catch { /* storage unavailable */ }
if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
const updateThemeLabel = () => document.querySelector('#theme-toggle').setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre');
updateThemeLabel();
let filter = { query: '', letter: '', kind: 'all', favorites: false, page: 1 };
let requestId = 0;
let dayKey = parisDate();
let lastHomeURL = '/';
const pageSize = 24;

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => element.classList.remove('visible'), 2400);
}
function updateSavedCount() { document.querySelector('#saved-count').textContent = saved.size; }
function toggleSaved(id) {
  saved.has(id) ? saved.delete(id) : saved.add(id);
  try { localStorage.setItem('philo-favorites', JSON.stringify([...saved])); } catch { toast('Favoris conservés pour cette session.'); }
  updateSavedCount();
  document.querySelectorAll('[data-save]').forEach(button => {
    const active = saved.has(button.dataset.save);
    button.classList.toggle('is-saved', active);
    button.setAttribute('aria-pressed', active);
    button.setAttribute('aria-label', `${active ? 'Retirer des' : 'Ajouter aux'} favoris : ${entryById.get(button.dataset.save)?.title || ''}`);
  });
  if (filter.favorites && !location.pathname.startsWith('/entree/')) renderResults();
}
const urlFor = entry => `/entree/${entry.id}`;
const kindLabel = entry => entry.kind === 'notion' ? 'Notion' : 'Auteur';
const saveButton = entry => `<button class="icon-button save-button ${saved.has(entry.id) ? 'is-saved' : ''}" data-save="${entry.id}" aria-label="${saved.has(entry.id) ? 'Retirer des' : 'Ajouter aux'} favoris : ${esc(entry.title)}" aria-pressed="${saved.has(entry.id)}" title="Enregistrer dans mes favoris">${icons.bookmark}</button>`;
function summary(entry, limit = 210) {
  let text = entry.summary.replace(/\*/g, '');
  if (text.length > limit) text = text.slice(0, limit).replace(/\s+\S*$/, '') + '…';
  return esc(text);
}
function renderDaily() {
  const today = dailyEntry(entries);
  if (!today) return '';
  const date = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date());
  return `<article class="daily-card" id="du-jour">
    <div class="daily-top"><span class="eyebrow">Définition du jour</span><span class="daily-date">${date}</span>${saveButton(today)}</div>
    <div class="daily-copy"><h2><a href="${urlFor(today)}">${esc(today.title)}</a></h2><p>${summary(today, 240)}</p><a href="${urlFor(today)}" class="read-link">Lire la définition ${icons.arrow}</a></div>
  </article>`;
}
function readFilters() {
  const params = new URLSearchParams(location.search);
  filter = { query: params.get('q') || '', letter: /^[A-Z]$/.test(params.get('lettre') || '') ? params.get('lettre') : '', kind: ['notion', 'philosophe'].includes(params.get('type')) ? params.get('type') : 'all', favorites: params.get('vue') === 'favoris', page: Math.max(1, Number(params.get('page')) || 1) };
}
function syncURL() {
  const params = new URLSearchParams();
  if (filter.query) params.set('q', filter.query);
  if (filter.letter) params.set('lettre', filter.letter);
  if (filter.kind !== 'all') params.set('type', filter.kind);
  if (filter.favorites) params.set('vue', 'favoris');
  if (filter.page > 1) params.set('page', filter.page);
  const query = params.toString();
  const next = '/' + (query ? '?' + query : '') + (location.hash || '');
  history.replaceState(null, '', next);
  lastHomeURL = next;
}
function renderHome() {
  const notionCount = entries.filter(e => e.kind === 'notion').length;
  document.title = 'La philosophie de A à Z — Le dictionnaire';
  main.innerHTML = `<section class="dictionary" id="dictionnaire">
    <div class="section-heading"><div><h1>${filter.favorites ? 'Mes favoris' : 'Dictionnaire de philosophie'}</h1><p class="dictionary-counts">${notionCount} notions · ${entries.length - notionCount} auteurs</p></div><button class="random-button" id="random-button">${icons.shuffle} Au hasard</button></div>
    <form class="search-form" role="search">${icons.search}<input type="search" id="search" placeholder="Rechercher une notion ou un auteur" aria-label="Rechercher une notion ou un philosophe" autocomplete="off" value="${esc(filter.query)}"><kbd>/</kbd></form>
    <div class="browse-controls"><div class="filter-tabs" aria-label="Type d’entrée"><button data-kind="all">Toutes les entrées</button><button data-kind="notion">Notions <span>${notionCount}</span></button><button data-kind="philosophe">Auteurs <span>${entries.length - notionCount}</span></button></div>${filter.favorites ? '<a href="/#dictionnaire" class="text-link">Voir tout le dictionnaire ↗</a>' : ''}</div>
    <nav class="alphabet" aria-label="Filtrer par lettre"><button data-letter="" aria-label="Toutes les lettres">A–Z</button>${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `<button data-letter="${letter}" ${entries.some(e => e.letter === letter) ? '' : 'disabled'} aria-label="Lettre ${letter}">${letter}</button>`).join('')}</nav>
    ${filter.favorites ? '' : renderDaily()}
    <div class="results-top"><span id="results-count" role="status" aria-live="polite"></span><button class="text-button" id="reset-filters" hidden>Effacer les filtres ×</button></div><div class="entry-grid" id="results"></div><nav id="pagination" class="pagination" aria-label="Pagination du dictionnaire"></nav>
  </section>`;
  renderResults();
  document.querySelector('#search').addEventListener('input', event => {
    filter.query = event.target.value;
    filter.page = 1;
    renderResults();
    syncURL();
  });
  document.querySelector('.search-form').addEventListener('submit', e => e.preventDefault());
  document.querySelector('#random-button').addEventListener('click', () => {
    const pool = entries.filter(e => e.kind === 'notion' && e.daily);
    navigate(urlFor(pool[Math.floor(Math.random() * pool.length)]));
  });
  document.querySelector('#reset-filters').addEventListener('click', () => {
    filter = { ...filter, query: '', letter: '', kind: 'all', page: 1 };
    document.querySelector('#search').value = '';
    renderResults(); syncURL();
  });
}
function renderResults() {
  const results = searchEntries(entries, filter.query, { letter: filter.letter, kind: filter.kind, saved: filter.favorites ? saved : null });
  const pageCount = Math.ceil(results.length / pageSize);
  filter.page = Math.min(Math.max(pageCount, 1), filter.page);
  const visible = results.slice((filter.page - 1) * pageSize, filter.page * pageSize);
  document.querySelector('#results-count').textContent = `${results.length} entrée${results.length > 1 ? 's' : ''}${filter.letter ? ' · Lettre ' + filter.letter : ''}${filter.favorites ? ' dans vos favoris' : ''}`;
  document.querySelectorAll('[data-kind]').forEach(b => { b.classList.toggle('active', b.dataset.kind === filter.kind); b.setAttribute('aria-pressed', b.dataset.kind === filter.kind); });
  document.querySelectorAll('[data-letter]').forEach(b => { b.classList.toggle('active', b.dataset.letter === filter.letter); b.setAttribute('aria-pressed', b.dataset.letter === filter.letter); });
  document.querySelector('#reset-filters').hidden = !filter.query && !filter.letter && filter.kind === 'all';
  document.querySelector('#results').innerHTML = visible.length ? visible.map(entry => `<article class="entry-card"><div class="card-top"><span class="entry-kind ${entry.kind}"><span></span>${kindLabel(entry)}</span>${saveButton(entry)}</div><h3><a href="${urlFor(entry)}">${esc(entry.title)}</a></h3><p>${summary(entry, 160)}</p><div class="card-bottom"><span>${entry.readingMinutes} min de lecture</span><a href="${urlFor(entry)}" aria-label="Lire : ${esc(entry.title)}">${icons.arrow}</a></div></article>`).join('') : `<div class="empty-state"><h3>${filter.favorites && !saved.size ? 'Aucun favori enregistré' : 'Aucune entrée trouvée'}</h3><p>${filter.favorites && !saved.size ? 'Enregistrez une entrée avec le marque-page pour la retrouver plus tard.' : 'Essayez un autre mot ou effacez les filtres.'}</p></div>`;
  const pages = [...new Set([1, filter.page - 1, filter.page, filter.page + 1, pageCount])].filter(p => p > 0 && p <= pageCount).sort((a, b) => a - b);
  document.querySelector('#pagination').innerHTML = pageCount > 1 ? `<button data-page="${filter.page - 1}" ${filter.page === 1 ? 'disabled' : ''} aria-label="Page précédente">←</button>${pages.map((page, i) => `${i && page - pages[i - 1] > 1 ? '<span>…</span>' : ''}<button data-page="${page}" class="${page === filter.page ? 'active' : ''}" ${page === filter.page ? 'aria-current="page"' : ''} aria-label="Page ${page}">${page}</button>`).join('')}<button data-page="${filter.page + 1}" ${filter.page === pageCount ? 'disabled' : ''} aria-label="Page suivante">→</button>` : '';
}
function linkedText(text) {
  // The source marks cross-references with an asterisk; match the longest title first.
  return text.split(/(\*)/).map((part, i, parts) => {
    if (part === '*') return '';
    if (parts[i + 1] !== '*') return esc(part);
    for (let length = Math.min(part.length, 65); length > 0; length--) {
      const term = part.slice(-length);
      if (length < part.length && /[\p{L}]/u.test(part[part.length - length - 1])) continue;
      const id = entryAliases.get(normalize(term));
      if (id) return `${esc(part.slice(0, -length))}<a href="/entree/${id}" class="reference-link">${esc(term)}</a>`;
    }
    return esc(part);
  }).join('');
}
function linkedTerms(text) {
  return text.split(/([,;])/).map(term => {
    const id = entryAliases.get(normalize(term.trim()));
    return id ? `<a class="reference-link" href="/entree/${id}">${esc(term)}</a>` : linkedText(term);
  }).join('');
}
function renderBlocks(blocks) {
  let sectionIndex = 0;
  let definitionOpen = false;
  let html = '';
  for (const [index, block] of blocks.entries()) {
    if (block.type === 'definition' && !definitionOpen) {
      html += '<section class="definition-panel" aria-label="Définition"><span class="definition-label">DÉFINITION</span>';
      definitionOpen = true;
    } else if (block.type !== 'definition' && definitionOpen) {
      html += '</section>';
      definitionOpen = false;
    }
    if (block.type === 'heading') html += `<h2 id="section-${sectionIndex++}">${esc(block.text)}</h2>`;
    else {
      let text = linkedText(block.text);
      if (block.type === 'definition') {
        text = text.replace(/\b(Sens ordinaire|Sens philosophique|Sens large(?: et philosophique)?|Philosophie|Métaphysique|Psychologie|Logique)\./g, '<strong class="sense-label">$1.</strong>');
      } else if (block.type === 'meta') {
        const match = block.text.match(/^([^:]+:)(.*)$/);
        if (match) text = `<strong>${esc(match[1])}</strong>${linkedTerms(match[2])}`;
      } else if (block.type === 'related') text = `<span class="related-label">Voir aussi</span>${linkedTerms(block.text)}`;
      html += `<p class="block-${block.type}${index === 0 && block.type === 'paragraph' ? ' lead-paragraph' : ''}">${text}</p>`;
    }
  }
  return html + (definitionOpen ? '</section>' : '');
}
async function renderEntry(id) {
  const token = ++requestId;
  const entry = entryById.get(id);
  if (!entry) { main.innerHTML = '<div class="empty-state"><h1>Cette entrée est introuvable.</h1><a href="/">Retour au dictionnaire</a></div>'; return; }
  main.innerHTML = '<div class="loading" role="status">Ouverture de l’entrée…</div>';
  try {
    const response = await fetch(`/data/entries/${encodeURIComponent(id)}.json`);
    if (!response.ok) throw new Error('Lecture impossible');
    const full = await response.json();
    if (token !== requestId) return;
    document.title = `${entry.title} — La philosophie de A à Z`;
    const position = entries.findIndex(e => e.id === id);
    const related = full.related.map(id => entryById.get(id)).filter(Boolean);
    const sections = full.blocks.filter(b => b.type === 'heading');
    main.innerHTML = `<div class="reader-layout">
      <div class="reader-breadcrumb"><a href="${esc(lastHomeURL.includes('#') ? lastHomeURL : lastHomeURL + '#dictionnaire')}">← Le dictionnaire</a><span>${esc(entry.letter)} / ${esc(entry.title)}</span></div>
      <article class="reader reader-${entry.kind}">
        <div class="reader-eyebrow"><span class="entry-kind ${entry.kind}"><span></span>${kindLabel(entry)}</span><span>${entry.readingMinutes} min de lecture · p. ${entry.page}${entry.endPage > entry.page ? '–' + entry.endPage : ''}</span></div>
        <div class="reader-title"><h1>${esc(entry.title)}</h1>${saveButton(entry)}</div>
        <div class="reader-text">${renderBlocks(full.blocks)}</div>
        <div class="reader-source"><span>La philosophie de A à Z · Hatier, 2021</span><span>p. ${entry.page}${entry.endPage > entry.page ? '–' + entry.endPage : ''}</span></div>
        <nav class="entry-navigation" aria-label="Entrées voisines">${position > 0 ? `<a href="${urlFor(entries[position - 1])}"><span>← ENTRÉE PRÉCÉDENTE</span>${esc(entries[position - 1].title)}</a>` : '<span></span>'}${position < entries.length - 1 ? `<a href="${urlFor(entries[position + 1])}"><span>ENTRÉE SUIVANTE →</span>${esc(entries[position + 1].title)}</a>` : ''}</nav>
      </article>
      <aside class="reader-sidebar">${sections.length ? `<div class="sidebar-section"><span class="eyebrow">DANS CETTE ENTRÉE</span><nav aria-label="Sommaire de l’entrée">${sections.map((s, i) => `<a href="#section-${i}">${esc(s.text)}</a>`).join('')}</nav></div>` : ''}${related.length ? `<div class="sidebar-section"><span class="eyebrow">ENTRÉES LIÉES</span>${related.map(e => `<a class="related-entry" href="${urlFor(e)}">${esc(e.title)} ${icons.arrow}</a>`).join('')}</div>` : ''}</aside>
    </div>`;
  } catch {
    if (token !== requestId) return;
    main.innerHTML = '<div class="empty-state"><h1>L’entrée n’a pas pu être chargée.</h1><p>Vérifiez votre connexion et réessayez.</p><button class="random-button" id="retry-entry">Réessayer</button></div>';
    document.querySelector('#retry-entry').onclick = () => renderEntry(id);
  }
}
async function route() {
  const match = location.pathname.match(/^\/entree\/([^/]+)\/?$/);
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === (location.search.includes('vue=favoris') ? 'saved' : location.hash === '#du-jour' ? 'daily' : 'dictionary')));
  if (match) await renderEntry(decodeURIComponent(match[1]));
  else if (location.pathname === '/') { ++requestId; readFilters(); lastHomeURL = location.pathname + location.search + location.hash; renderHome(); }
  else { ++requestId; main.innerHTML = '<div class="empty-state"><h1>Cette page est introuvable.</h1><a href="/">Retour au dictionnaire</a></div>'; }
  if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
}
async function navigate(href) {
  history.pushState(null, '', href);
  await route();
  if (!location.hash) window.scrollTo(0, 0);
}
document.addEventListener('click', event => {
  const save = event.target.closest('[data-save]');
  if (save) { toggleSaved(save.dataset.save); return; }
  const kind = event.target.closest('[data-kind]');
  if (kind) { filter.kind = kind.dataset.kind; filter.page = 1; renderResults(); syncURL(); return; }
  const letter = event.target.closest('[data-letter]');
  if (letter && !letter.disabled) { filter.letter = letter.dataset.letter; filter.page = 1; renderResults(); syncURL(); return; }
  const page = event.target.closest('[data-page]');
  if (page && !page.disabled) { filter.page = Number(page.dataset.page); renderResults(); syncURL(); document.querySelector('#dictionnaire').scrollIntoView(); return; }
  const link = event.target.closest('a');
  if (!link || link.target || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || link.getAttribute('href').startsWith('#')) return;
  if (url.pathname !== '/' && !url.pathname.startsWith('/entree/')) return;
  event.preventDefault();
  navigate(url.pathname + url.search + url.hash);
});
window.addEventListener('popstate', route);
document.querySelector('#theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('philo-theme', next); } catch { /* storage unavailable */ }
  updateThemeLabel();
});
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
    const search = document.querySelector('#search');
    if (search) { e.preventDefault(); search.focus(); search.scrollIntoView({ block: 'center' }); }
  }
});
document.querySelector('#about-button').addEventListener('click', () => document.querySelector('#about-dialog').showModal());
document.querySelector('.dialog-close').addEventListener('click', () => document.querySelector('#about-dialog').close());
document.querySelector('#about-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
async function start() {
  try {
    const response = await fetch('/data/index.json');
    if (!response.ok) throw new Error('Index indisponible');
    entries = await response.json();
    entryById = new Map(entries.map(e => [e.id, e]));
    entryAliases = new Map(entries.flatMap(e => (e.aliases || [e.title]).map(title => [normalize(title), e.id])));
    saved = new Set([...saved].filter(id => entryById.has(id)));
    updateSavedCount();
    await route();
  } catch {
    main.innerHTML = '<div class="empty-state"><h1>Le dictionnaire n’a pas pu être chargé.</h1><p>Vérifiez votre connexion, puis rechargez la page.</p><button class="random-button" id="retry-start">Réessayer</button></div>';
    document.querySelector('#retry-start').onclick = start;
  }
}
// Refresh at midnight in Paris, including when a sleeping tab becomes visible.
function checkDay() {
  const next = parisDate();
  if (next !== dayKey) {
    dayKey = next;
    const card = document.querySelector('#du-jour');
    if (card) card.outerHTML = renderDaily();
  }
}
setInterval(checkDay, 1000);
document.addEventListener('visibilitychange', checkDay);
start();

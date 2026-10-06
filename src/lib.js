export function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae').toLowerCase();
}

export function parisDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type) => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// A permutation of the eligible entries: one new entry per Paris calendar day.
export function dailyEntry(entries, date = new Date()) {
  const pool = entries.filter(e => e.kind === 'notion' && e.daily);
  if (!pool.length) return null;
  const day = Math.floor(Date.parse(`${parisDate(date)}T00:00:00Z`) / 86400000);
  let step = 137;
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  while (gcd(step, pool.length) !== 1) step += 2;
  return pool[((day * step + 41) % pool.length + pool.length) % pool.length];
}

export function searchEntries(entries, query, { letter = '', kind = 'all', saved = null } = {}) {
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
  const found = entries.filter(entry => {
    if (letter && entry.letter !== letter) return false;
    if (kind !== 'all' && entry.kind !== kind) return false;
    if (saved && !saved.has(entry.id)) return false;
    return words.every(word => normalize(entry.title + ' ' + entry.summary).includes(word));
  });
  if (words.length) {
    const q = normalize(query.trim());
    const rank = e => normalize(e.title) === q ? 0 : normalize(e.title).startsWith(q) ? 1 : normalize(e.title).includes(q) ? 2 : 3;
    found.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, 'fr'));
  }
  return found;
}

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

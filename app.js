/* AniAgenda v2 — temporada, listas, vistos, favoritos, notas, estadísticas, calendario y alertas.
   Sin dependencias ni compilación. Datos: API GraphQL pública de AniList. */
'use strict';

/* ================= Configuración ================= */
const API = 'https://graphql.anilist.co';
const LS_KEY = 'aniagenda.v2';
const LEGACY_KEY = 'aniagenda.v1';
const SCHEMA_VERSION = 2;
const TZ = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'America/Mexico_City';
const LOCALE = 'es-MX';
const STATUS = { viendo: 'Viendo', pendiente: 'Pendiente', terminado: 'Terminado' };
const MEDIA_STATUS = {
  RELEASING: 'En emisión', FINISHED: 'Finalizado', NOT_YET_RELEASED: 'Próximamente',
  CANCELLED: 'Cancelado', HIATUS: 'En pausa',
};
const FORMAT = { TV: 'TV', TV_SHORT: 'TV corto', MOVIE: 'Película', SPECIAL: 'Especial', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Música' };
const SEASON = { WINTER: 'Invierno', SPRING: 'Primavera', SUMMER: 'Verano', FALL: 'Otoño' };
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/* Clasificaciones: géneros + demografía (tags de AniList) en español */
const TYPES = {
  shounen: { label: 'Shounen', demo: true }, shoujo: { label: 'Shoujo', demo: true },
  seinen: { label: 'Seinen', demo: true }, josei: { label: 'Josei', demo: true }, kids: { label: 'Infantil', demo: true },
  romcom: { label: 'Comedia romántica' },
  accion: { label: 'Acción' }, aventura: { label: 'Aventura' }, comedia: { label: 'Comedia' }, romance: { label: 'Romance' },
  drama: { label: 'Drama' }, fantasia: { label: 'Fantasía' }, isekai: { label: 'Isekai' }, slice: { label: 'Recuentos de la vida' },
  deportes: { label: 'Deportes' }, misterio: { label: 'Misterio' }, terror: { label: 'Terror' }, suspenso: { label: 'Suspenso' },
  mecha: { label: 'Mecha' }, musica: { label: 'Música' }, scifi: { label: 'Sci-fi' }, sobrenatural: { label: 'Sobrenatural' },
  psicologico: { label: 'Psicológico' }, mahou: { label: 'Mahou shoujo' }, escolar: { label: 'Escolar' },
  historico: { label: 'Histórico' }, ecchi: { label: 'Ecchi' },
};
const GENRE_KEY = {
  Action: 'accion', Adventure: 'aventura', Comedy: 'comedia', Drama: 'drama', Ecchi: 'ecchi', Fantasy: 'fantasia',
  Horror: 'terror', 'Mahou Shoujo': 'mahou', Mecha: 'mecha', Music: 'musica', Mystery: 'misterio',
  Psychological: 'psicologico', Romance: 'romance', 'Sci-Fi': 'scifi', 'Slice of Life': 'slice', Sports: 'deportes',
  Supernatural: 'sobrenatural', Thriller: 'suspenso',
};
const TAG_KEY = { Shounen: 'shounen', Shoujo: 'shoujo', Seinen: 'seinen', Josei: 'josei', Kids: 'kids', Isekai: 'isekai', School: 'escolar', Historical: 'historico' };
const TYPE_ORDER = Object.keys(TYPES);

const LIST_EMOJIS = ['📺', '⭐', '🔥', '💖', '😂', '😭', '⚔️', '🌸', '👻', '🤖', '🍿', '🏆'];
const LIST_COLORS = ['#7c5cff', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

const MEDIA_FIELDS = `
  id siteUrl isAdult popularity episodes duration status format season seasonYear averageScore genres bannerImage
  title { romaji english userPreferred }
  coverImage { large extraLarge color }
  tags { name rank isMediaSpoiler }
  nextAiringEpisode { episode airingAt }`;
const Q_SEARCH = `query ($search: String, $status: MediaStatus, $sort: [MediaSort]) {
  Page(page: 1, perPage: 30) { media(search: $search, type: ANIME, isAdult: false, status: $status, sort: $sort) { ${MEDIA_FIELDS} } }
}`;
const Q_SEASON = `query ($season: MediaSeason, $year: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(season: $season, seasonYear: $year, type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) { ${MEDIA_FIELDS} }
  }
}`;
const Q_BY_IDS = `query ($ids: [Int]) { Page(page: 1, perPage: 50) { media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} } } }`;
const Q_SCHEDULE = `query ($start: Int, $end: Int, $page: Int, $ids: [Int]) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, mediaId_in: $ids, sort: TIME) {
      id episode airingAt media { ${MEDIA_FIELDS} }
    }
  }
}`;

/* ================= Utilidades ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowSec = () => Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const cap = (t) => String(t).charAt(0).toUpperCase() + String(t).slice(1);
const fmtTime = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
const fmtDayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const fmtDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtFull = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

function timeParts(epoch) {
  const s = fmtTime.format(new Date(epoch * 1000));
  const m = s.match(/^([\d:]+)[\s\u00a0\u202f]*(.*)$/);
  return m ? { hm: m[1], ap: m[2] } : { hm: s, ap: '' };
}
function dur(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d > 0) return h ? `${d} d ${h} h` : `${d} d`;
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return `${Math.max(1, m)} min`;
}
function cdInfo(at) {
  const diff = at - nowSec();
  if (diff > 0) return { cls: diff < 3600 ? 'soon' : 'countdown', text: `en ${dur(diff)}` };
  if (diff > -60) return { cls: 'live', text: 'Saliendo ahora' };
  if (diff > -3 * 3600) return { cls: 'live', text: `Salió hace ${dur(-diff)}` };
  return { cls: 'aired', text: 'Emitido' };
}
const ICON = {
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5C19 15.6 12 20 12 20z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/><circle cx="8.5" cy="15.5" r="1.2"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
};
function cdPill(at, prefix = '') {
  const c = cdInfo(at);
  return `<span class="pill ${c.cls}" data-at="${at}">${ICON.clock}${prefix ? `<b>${esc(prefix)}</b>` : ''}<span>${esc(c.text)}</span></span>`;
}
function updateCountdowns() {
  document.querySelectorAll('[data-at]').forEach((el) => {
    const c = cdInfo(Number(el.dataset.at));
    el.className = `pill ${c.cls}`;
    const span = el.querySelector('span');
    if (span && span.textContent !== c.text) span.textContent = c.text;
  });
}
function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function weekStart(offset = 0) {
  const d = startOfDay();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d;
}
const dayIdx = (date) => (date.getDay() + 6) % 7;
const dateKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const sameDay = (a, b) => dateKey(a) === dateKey(b);
const toInputDate = (ms) => { if (!ms) return ''; const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fromInputDate = (v) => { if (!v) return null; const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };

function currentSeason(d = new Date()) {
  const m = d.getMonth();
  const season = m <= 2 ? 'WINTER' : m <= 5 ? 'SPRING' : m <= 8 ? 'SUMMER' : 'FALL';
  const year = d.getFullYear();
  return { season, year, key: `${season}-${year}`, label: `${SEASON[season]} ${year}` };
}
const SEASON_NOW = currentSeason();

function titleOf(m) { return (m.title && (m.title.userPreferred || m.title.romaji || m.title.english)) || 'Sin título'; }
function seasonText(m) {
  const p = [];
  if (m.format) p.push(FORMAT[m.format] || m.format);
  if (m.season && m.seasonYear) p.push(`${SEASON[m.season] || ''} ${m.seasonYear}`);
  else if (m.seasonYear) p.push(m.seasonYear);
  if (m.episodes) p.push(`${m.episodes} eps`);
  return p.join(' · ');
}

/* Clasificación por tipo */
function typesFrom(genres = [], tags = []) {
  const set = new Set();
  genres.forEach((g) => GENRE_KEY[g] && set.add(GENRE_KEY[g]));
  tags.forEach((t) => {
    const name = typeof t === 'string' ? t : t && t.name;
    const ok = typeof t === 'string' || (!t.isMediaSpoiler && (t.rank == null || t.rank >= 50));
    if (ok && TAG_KEY[name]) set.add(TAG_KEY[name]);
  });
  if (set.has('comedia') && set.has('romance')) set.add('romcom');
  return TYPE_ORDER.filter((k) => set.has(k));
}
const mediaTypes = (m) => typesFrom(m.genres || [], m.tags || []);
function displayTypes(types) { // "Comedia romántica" sustituye a Comedia + Romance al mostrar
  const t = types.includes('romcom') ? types.filter((k) => k !== 'comedia' && k !== 'romance') : types;
  return t;
}
function typeChip(k) {
  const t = TYPES[k]; if (!t) return '';
  return `<span class="tag${t.demo ? ' demo' : ''}">${esc(t.label)}</span>`;
}
const customChip = (t) => `<span class="tag custom">#${esc(t)}</span>`;

/* ================= Estado + migración ================= */
const defaultSettings = () => ({ notify: false, lead: 0, includePending: true, bannerDismissed: '' });
const defaultState = () => ({
  version: SCHEMA_VERSION,
  anime: {},      // id -> entrada
  lists: {},      // id -> { id, name, emoji, color, createdAt }
  settings: defaultSettings(),
  notified: {},
  schedule: { fetchedAt: 0, key: '', items: [] },
  listRefreshedAt: 0,
  migratedFrom: null,
});

function normalizeEntry(e) {
  if (!e || !e.id) return null;
  const n = { ...e };
  n.id = Number(e.id);
  n.status = STATUS[e.status] ? e.status : null;
  n.progress = Math.max(0, Math.round(Number(e.progress) || 0));
  n.score = Math.max(0, Math.min(10, Math.round(Number(e.score) || 0)));
  n.favorite = Boolean(e.favorite);
  n.customTags = Array.isArray(e.customTags) ? e.customTags.filter((t) => typeof t === 'string' && t.trim()).slice(0, 20) : [];
  n.notes = Array.isArray(e.notes) ? e.notes.filter((x) => x && x.id && typeof x.text === 'string') : [];
  n.lists = Array.isArray(e.lists) ? e.lists.map(String) : [];
  n.rewatches = Math.max(0, Number(e.rewatches) || 0);
  n.addedAt = Number(e.addedAt) || Date.now();
  n.startedAt = e.startedAt || null;
  n.finishedAt = e.finishedAt || null;
  n.genres = Array.isArray(e.genres) ? e.genres : [];
  n.tagNames = Array.isArray(e.tagNames) ? e.tagNames : [];
  n.types = typesFrom(n.genres, n.tagNames);
  n.title = e.title || 'Sin título';
  n.color = e.color || '#7c5cff';
  return n;
}

/* v1 -> v2: { list, settings, notified, schedule } -> { version:2, anime, lists, ... } */
function migrateV1(raw) {
  const s = defaultState();
  s.settings = { ...s.settings, ...(raw.settings || {}) };
  s.notified = raw.notified || {};
  s.schedule = raw.schedule || s.schedule;
  s.listRefreshedAt = 0; // vuelve a pedir datos (tags/duración) a AniList
  Object.values(raw.list || {}).forEach((it) => {
    const e = normalizeEntry({
      ...it,
      startedAt: (it.progress > 0 || it.status === 'viendo') ? (it.addedAt || Date.now()) : null,
      finishedAt: it.status === 'terminado' ? (it.addedAt || Date.now()) : null,
      finishedApprox: it.status === 'terminado',
    });
    if (e) s.anime[e.id] = e;
  });
  s.migratedFrom = 1;
  return s;
}
function upgrade(raw) {
  if (!raw || typeof raw !== 'object') return defaultState();
  const v = raw.version || (raw.list ? 1 : SCHEMA_VERSION);
  let s = v < 2 ? migrateV1(raw) : raw;
  const d = defaultState();
  s = { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, version: SCHEMA_VERSION };
  const anime = {};
  Object.values(s.anime || {}).forEach((e) => { const n = normalizeEntry(e); if (n) anime[n.id] = n; });
  s.anime = anime;
  const lists = {};
  Object.values(s.lists || {}).forEach((l) => { if (l && l.id && l.name) lists[l.id] = { id: String(l.id), name: String(l.name).slice(0, 40), emoji: l.emoji || '📺', color: l.color || LIST_COLORS[0], createdAt: l.createdAt || Date.now() }; });
  s.lists = lists;
  Object.values(s.anime).forEach((e) => { e.lists = e.lists.filter((id) => lists[id]); });
  return s;
}
let justMigrated = false;
function loadState() {
  try {
    const cur = localStorage.getItem(LS_KEY);
    if (cur) return upgrade(JSON.parse(cur));
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const s = upgrade(JSON.parse(legacy));
      justMigrated = true;
      localStorage.setItem(LS_KEY, JSON.stringify(s)); // la clave v1 se conserva como respaldo
      return s;
    }
  } catch (e) { console.warn('Datos guardados ilegibles, se inicia vacío', e); }
  return defaultState();
}
let state = loadState();
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { console.warn('No se pudo guardar', e); }
}

const ui = {
  route: 'inicio',
  listTab: 'viendo',
  listQuery: '',
  sort: 'smart',
  typeFilter: { home: null, search: null, lists: null },
  profileTab: 'stats',
  calMode: 'mine', weekOffset: 0, selectedDay: null,
  search: { q: '', results: null, loading: false, error: null, seq: 0 },
  trending: null, trendingError: null,
  season: null, seasonError: null, seasonLoading: false,
  weekCache: {}, weekLoading: false, weekError: null,
  mediaCache: {},
  sheetId: null, openSecs: new Set(['notas']), editingNote: null,
  installEvt: null,
  lastPick: null,
};

/* ================= API AniList ================= */
async function gql(query, variables = {}, attempt = 0) {
  let res;
  try {
    res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query, variables }) });
  } catch (e) { throw new Error('Sin conexión con AniList. Revisa tu internet.'); }
  if (res.status === 429 && attempt < 2) {
    const wait = Number(res.headers.get('Retry-After')) || 5;
    await sleep(Math.min(wait, 60) * 1000);
    return gql(query, variables, attempt + 1);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.errors) {
    const msg = json && json.errors && json.errors[0] && json.errors[0].message;
    throw new Error(msg ? `AniList: ${msg}` : `AniList respondió ${res.status}`);
  }
  return json.data;
}
function cacheMedia(list) { (list || []).forEach((m) => { if (m && m.id) ui.mediaCache[m.id] = m; }); return list; }
async function searchAnime(q) {
  const vars = q ? { search: q, sort: ['SEARCH_MATCH'] } : { status: 'RELEASING', sort: ['POPULARITY_DESC'] };
  const data = await gql(Q_SEARCH, vars);
  return cacheMedia(data.Page.media.filter((m) => !m.isAdult));
}
async function fetchSeason() {
  const out = [];
  for (let page = 1; page <= 2; page++) {
    const data = await gql(Q_SEASON, { season: SEASON_NOW.season, year: SEASON_NOW.year, page });
    out.push(...data.Page.media.filter((m) => !m.isAdult));
    if (!data.Page.pageInfo.hasNextPage) break;
  }
  return cacheMedia(out);
}
async function fetchSchedules(start, end, ids) {
  const out = [];
  for (let page = 1; page <= 12; page++) {
    const vars = { start, end, page };
    if (ids) vars.ids = ids;
    const p = (await gql(Q_SCHEDULE, vars)).Page;
    p.airingSchedules.forEach((s) => { if (s.media && !s.media.isAdult) { cacheMedia([s.media]); out.push(s); } });
    if (!p.pageInfo.hasNextPage) break;
  }
  return out;
}

/* ================= Entradas (tu colección) ================= */
function mediaFields(m) {
  return {
    id: m.id,
    title: titleOf(m),
    titleEn: (m.title && m.title.english) || '',
    titleRomaji: (m.title && m.title.romaji) || '',
    cover: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || '',
    coverSmall: (m.coverImage && (m.coverImage.large || m.coverImage.extraLarge)) || '',
    color: (m.coverImage && m.coverImage.color) || '#7c5cff',
    banner: m.bannerImage || '',
    episodes: m.episodes || null,
    duration: m.duration || null,
    mediaStatus: m.status || '',
    format: m.format || '', season: m.season || '', seasonYear: m.seasonYear || null,
    avg: m.averageScore || null,
    genres: m.genres || [],
    tagNames: (m.tags || []).filter((t) => !t.isMediaSpoiler && (t.rank == null || t.rank >= 50)).map((t) => t.name),
    siteUrl: m.siteUrl || `https://anilist.co/anime/${m.id}`,
    next: m.nextAiringEpisode ? { episode: m.nextAiringEpisode.episode, airingAt: m.nextAiringEpisode.airingAt } : null,
  };
}
const entries = () => Object.values(state.anime);
const entry = (id) => state.anime[id] || null;
const hasStatus = (id) => Boolean(state.anime[id] && state.anime[id].status);
const followedStatuses = () => (state.settings.includePending ? ['viendo', 'pendiente'] : ['viendo']);

function ensureEntry(id) {
  if (state.anime[id]) return state.anime[id];
  const m = ui.mediaCache[id]; if (!m) return null;
  state.anime[id] = normalizeEntry({ ...mediaFields(m), status: null, addedAt: Date.now() });
  return state.anime[id];
}
function isEmptyEntry(e) { return !e.status && !e.favorite && !e.lists.length && !e.notes.length && !e.score && !e.customTags.length; }
function gc(id) { const e = state.anime[id]; if (e && isEmptyEntry(e)) delete state.anime[id]; }

function addAnime(id, status, opts = {}) {
  const existed = hasStatus(id);
  const e = ensureEntry(id); if (!e) return;
  if (!status) status = e.mediaStatus === 'NOT_YET_RELEASED' ? 'pendiente' : 'viendo';
  e.status = status;
  if (opts.season) e.seasonPick = SEASON_NOW.key;
  if (status === 'viendo' && !e.startedAt) e.startedAt = Date.now();
  if (status === 'terminado') { finish(id, { silent: false }); return; }
  save();
  if (!existed) toast(`Agregado a <b>${status === 'viendo' && opts.season ? 'Viendo esta temporada' : STATUS[status]}</b>`, { img: e.coverSmall, action: { label: 'Abrir', fn: () => openSheet(id) } });
  afterChange(true);
}
function finish(id, { silent = false } = {}) {
  const e = entry(id); if (!e) return;
  e.status = 'terminado';
  if (e.episodes) e.progress = e.episodes;
  e.finishedAt = Date.now(); e.finishedApprox = false;
  if (!e.startedAt) e.startedAt = e.addedAt;
  save();
  if (!silent) celebrate(e);
  afterChange(true);
}
function celebrate(e) {
  toast(`🎉 ¡Terminaste <b>${esc(e.title)}</b>! Ya está en <b>Vistos</b>.`, {
    img: e.coverSmall, timeout: 9000, cls: 'celebrate',
    action: { label: e.score ? 'Cambiar ★' : 'Puntuar ★', fn: () => openRateDialog(e.id) },
  });
  burst();
}
function setStatus(id, status) {
  const e = ensureEntry(id); if (!e) return;
  if (status === 'terminado') { if (e.status !== 'terminado') finish(id); return; }
  e.status = status;
  if (status === 'viendo' && !e.startedAt) e.startedAt = Date.now();
  save(); afterChange(true);
}
function setProgress(id, value, fromPlus = false) {
  const e = entry(id); if (!e) return;
  const max = e.episodes || 9999;
  const v = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
  if (fromPlus && v === e.progress) { toast('Ya marcaste todos los episodios'); return; }
  const prevStatus = e.status;
  e.progress = v;
  if (v > 0 && !e.startedAt) e.startedAt = Date.now();
  if (v > 0 && (e.status === 'pendiente' || !e.status)) e.status = 'viendo';
  if (e.episodes && v >= e.episodes && e.status !== 'terminado') { finish(id); return; }
  if (e.status === 'terminado' && e.episodes && v < e.episodes) { e.status = 'viendo'; }
  save();
  if (prevStatus !== e.status) afterChange(false);
  else { refreshCard(id); if (ui.sheetId === id) renderSheet(); }
}
function setScore(id, score) {
  const e = ensureEntry(id); if (!e) return;
  e.score = Math.max(0, Math.min(10, Number(score) || 0));
  gc(id); save(); refreshCard(id);
  if (ui.sheetId === id) renderSheet();
  if (ui.route === 'perfil') render();
}
function toggleFavorite(id) {
  const e = ensureEntry(id); if (!e) return;
  e.favorite = !e.favorite;
  const on = e.favorite;
  gc(id); save();
  toast(on ? `💖 <b>${esc(e.title)}</b> en Favoritos` : 'Quitado de Favoritos');
  document.querySelectorAll(`[data-act="fav"][data-id="${id}"]`).forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  if (ui.route === 'listas' && ui.listTab === 'favoritos') renderListResults();
  if (ui.sheetId === id) renderSheet();
}
function availableEpisodes(e) {
  if (e.next && e.next.episode) return e.next.episode - 1;
  if (e.mediaStatus === 'FINISHED' && e.episodes) return e.episodes;
  return null;
}
function removeEntry(id) {
  const e = entry(id); if (!e) return;
  const copy = JSON.parse(JSON.stringify(e));
  delete state.anime[id];
  save(); closeSheet();
  toast(`Quitaste <b>${esc(e.title)}</b>`, { img: e.coverSmall, action: { label: 'Deshacer', fn: () => { state.anime[id] = normalizeEntry(copy); save(); afterChange(true); } } });
  afterChange(true);
}
function rewatch(id) {
  const e = entry(id); if (!e) return;
  e.rewatches = (e.rewatches || 0) + 1;
  e.status = 'viendo'; e.progress = 0; e.startedAt = Date.now();
  save(); toast(`🔁 ¡A verlo otra vez! Vez número ${e.rewatches + 1}`); afterChange(true);
}

/* Notas */
function addNote(id, text, ep) {
  text = String(text || '').trim(); if (!text) { toast('Escribe algo en la nota'); return false; }
  const e = ensureEntry(id); if (!e) return false;
  const now = Date.now();
  e.notes.unshift({ id: uid(), text: text.slice(0, 2000), ep: ep ? Math.max(1, Math.round(Number(ep))) : null, createdAt: now, updatedAt: now });
  save(); return true;
}
function updateNote(id, noteId, text, ep) {
  const e = entry(id); const n = e && e.notes.find((x) => x.id === noteId); if (!n) return;
  text = String(text || '').trim(); if (!text) { toast('La nota no puede quedar vacía'); return; }
  n.text = text.slice(0, 2000); n.ep = ep ? Math.max(1, Math.round(Number(ep))) : null; n.updatedAt = Date.now();
  save();
}
function deleteNote(id, noteId) {
  const e = entry(id); if (!e) return;
  const idx = e.notes.findIndex((x) => x.id === noteId); if (idx < 0) return;
  const [n] = e.notes.splice(idx, 1);
  save(); renderSheet();
  toast('Nota eliminada', { action: { label: 'Deshacer', fn: () => { const en = ensureEntry(id) || state.anime[id]; if (en) { en.notes.splice(idx, 0, n); save(); renderSheet(); } } } });
}

/* Etiquetas propias */
function addCustomTag(id, tag) {
  tag = String(tag || '').trim().replace(/^#/, '').slice(0, 24);
  if (!tag) return;
  const e = ensureEntry(id); if (!e) return;
  if (!e.customTags.some((t) => t.toLowerCase() === tag.toLowerCase())) e.customTags.push(tag);
  save(); renderSheet(); refreshCard(id);
}
function removeCustomTag(id, tag) {
  const e = entry(id); if (!e) return;
  e.customTags = e.customTags.filter((t) => t !== tag);
  gc(id); save(); renderSheet(); refreshCard(id);
}
const allCustomTags = () => [...new Set(entries().flatMap((e) => e.customTags))].sort((a, b) => a.localeCompare(b, LOCALE));

/* Listas personalizadas */
function createList(name, emoji, color) {
  name = String(name || '').trim().slice(0, 40); if (!name) return null;
  const id = uid();
  state.lists[id] = { id, name, emoji: emoji || '📺', color: color || LIST_COLORS[0], createdAt: Date.now() };
  save(); return id;
}
function updateList(id, name, emoji, color) {
  const l = state.lists[id]; if (!l) return;
  name = String(name || '').trim().slice(0, 40); if (name) l.name = name;
  if (emoji) l.emoji = emoji; if (color) l.color = color;
  save();
}
function deleteList(id) {
  const l = state.lists[id]; if (!l) return;
  const members = entries().filter((e) => e.lists.includes(id)).map((e) => e.id);
  delete state.lists[id];
  members.forEach((aid) => { const e = state.anime[aid]; e.lists = e.lists.filter((x) => x !== id); });
  if (ui.listTab === `list:${id}`) ui.listTab = 'viendo';
  save(); render();
  toast(`Lista “${esc(l.name)}” eliminada`, { action: { label: 'Deshacer', fn: () => {
    state.lists[id] = l; members.forEach((aid) => { const e = state.anime[aid]; if (e && !e.lists.includes(id)) e.lists.push(id); });
    ui.listTab = `list:${id}`; save(); render();
  } } });
}
function toggleInList(animeId, listId) {
  const e = ensureEntry(animeId); const l = state.lists[listId]; if (!e || !l) return;
  const on = !e.lists.includes(listId);
  e.lists = on ? [...e.lists, listId] : e.lists.filter((x) => x !== listId);
  gc(animeId); save();
  toast(on ? `Agregado a ${esc(l.emoji)} <b>${esc(l.name)}</b>` : `Quitado de ${esc(l.emoji)} ${esc(l.name)}`);
  renderSheet();
  if (ui.route === 'listas') renderListResults();
}

function afterChange(refetch = true) {
  ui.weekCache = Object.fromEntries(Object.entries(ui.weekCache).filter(([k]) => !k.startsWith('mine')));
  if (refetch) refreshSchedule(true);
  render();
  if (ui.sheetId) renderSheet();
  renderBanner();
}

async function refreshListInfo(force = false) {
  const ids = Object.keys(state.anime).map(Number);
  if (!ids.length) return;
  if (!force && Date.now() - state.listRefreshedAt < 30 * 60 * 1000) return;
  try {
    for (let i = 0; i < ids.length; i += 50) {
      const data = await gql(Q_BY_IDS, { ids: ids.slice(i, i + 50) });
      cacheMedia(data.Page.media).forEach((m) => {
        const cur = state.anime[m.id];
        if (cur) state.anime[m.id] = normalizeEntry({ ...cur, ...mediaFields(m) });
      });
    }
    state.listRefreshedAt = Date.now();
    save();
    if (['inicio', 'listas', 'perfil'].includes(ui.route) && ui.sheetId == null) render();
  } catch (e) { console.warn('No se pudo actualizar la lista:', e.message); }
}
async function refreshSchedule(force = false) {
  const ids = entries().filter((e) => e.status === 'viendo' || e.status === 'pendiente').map((e) => e.id).sort((a, b) => a - b);
  const key = ids.join(',');
  if (!ids.length) { state.schedule = { fetchedAt: Date.now(), key, items: [] }; save(); renderBanner(); return; }
  if (!force && state.schedule.key === key && Date.now() - state.schedule.fetchedAt < 30 * 60 * 1000) return;
  try {
    const start = Math.floor(startOfDay().getTime() / 1000) - 3600;
    const end = nowSec() + 8 * 86400;
    const items = [];
    for (let i = 0; i < ids.length; i += 50) {
      (await fetchSchedules(start, end, ids.slice(i, i + 50))).forEach((s) => items.push({ mediaId: s.media.id, episode: s.episode, airingAt: s.airingAt }));
    }
    state.schedule = { fetchedAt: Date.now(), key, items };
    save(); renderBanner();
    if (ui.route === 'perfil' && ui.profileTab === 'ajustes') render();
    checkAlerts();
  } catch (e) { console.warn('No se pudo actualizar el calendario:', e.message); }
}
function upcomingEpisodes() {
  const map = new Map();
  state.schedule.items.forEach((s) => map.set(`${s.mediaId}-${s.episode}`, s));
  entries().forEach((e) => { if (e.next) { const k = `${e.id}-${e.next.episode}`; if (!map.has(k)) map.set(k, { mediaId: e.id, episode: e.next.episode, airingAt: e.next.airingAt }); } });
  return [...map.values()].filter((s) => state.anime[s.mediaId] && state.anime[s.mediaId].status).sort((a, b) => a.airingAt - b.airingAt);
}

/* ================= Toasts y confeti ================= */
function toast(html, opts = {}) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast${opts.cls ? ' ' + opts.cls : ''}`;
  el.innerHTML = `${opts.img ? `<img src="${esc(opts.img)}" alt="">` : ''}<span class="msg">${html}</span>${opts.action ? `<button type="button">${esc(opts.action.label)}</button>` : ''}`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  if (opts.action) el.querySelector('button').addEventListener('click', () => { opts.action.fn(); close(); });
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(close, opts.timeout || 4200);
}
function burst() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const wrap = document.createElement('div');
  wrap.className = 'burst';
  const colors = ['#7c5cff', '#ec4899', '#fbbf24', '#34d399', '#60a5fa'];
  for (let i = 0; i < 28; i++) {
    const s = document.createElement('i');
    const a = (Math.PI * 2 * i) / 28, r = 90 + Math.random() * 120;
    s.style.setProperty('--x', `${Math.cos(a) * r}px`);
    s.style.setProperty('--y', `${Math.sin(a) * r - 60}px`);
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = `${Math.random() * 80}ms`;
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 1400);
}

/* ================= Router ================= */
const ROUTES = ['inicio', 'listas', 'calendario', 'buscar', 'perfil'];
const ALIASES = { lista: 'listas', alertas: 'perfil', temporada: 'inicio', '': 'inicio' };
function onRoute() {
  let r = (location.hash.replace(/^#\/?/, '') || 'inicio').split(/[?/]/)[0];
  if (r === 'alertas') ui.profileTab = 'ajustes';
  r = ALIASES[r] || r;
  ui.route = ROUTES.includes(r) ? r : 'inicio';
  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.dataset.route === ui.route;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  closeSheet(); closeDialog();
  render(true);
  renderBanner();
  window.scrollTo({ top: 0 });
}
function render(animate = false) {
  const view = $('#view');
  const fn = { inicio: renderHome, listas: renderLists, calendario: renderCalendar, buscar: renderSearch, perfil: renderProfile }[ui.route];
  if (animate) { view.style.animation = 'none'; void view.offsetWidth; view.style.animation = ''; }
  fn(view);
  updateNavDot();
}
function updateNavDot() {
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const following = entries().some((e) => e.status === 'viendo');
  $('#navDot').hidden = !(following && (perm === 'default' || (perm === 'granted' && !state.settings.notify)));
}

/* ================= Banner "Hoy sale(n)" ================= */
function renderBanner() {
  const box = $('#todayBanner');
  const today = new Date();
  if (state.settings.bannerDismissed === dateKey(today) || !['inicio', 'calendario'].includes(ui.route)) { box.innerHTML = ''; return; }
  const eps = upcomingEpisodes().filter((s) => sameDay(new Date(s.airingAt * 1000), today) && ['viendo', 'pendiente'].includes(state.anime[s.mediaId].status));
  if (!eps.length) { box.innerHTML = ''; return; }
  const pending = eps.filter((s) => s.airingAt > nowSec()).length;
  box.innerHTML = `
    <div class="today-banner" role="status">
      <div class="tb-icon" aria-hidden="true">📺</div>
      <div class="tb-body">
        <strong>${eps.length === 1 ? 'Hoy sale 1 episodio' : `Hoy salen ${eps.length} episodios`} de tu lista${pending && pending < eps.length ? ` · faltan ${pending}` : ''}</strong>
        <div class="tb-list">${eps.map((s) => {
          const e = state.anime[s.mediaId];
          return `<button class="tb-item" data-act="open" data-id="${e.id}">${s.airingAt <= nowSec() ? '✓' : '⏰'} ${esc(fmtTime.format(new Date(s.airingAt * 1000)))} · ${esc(e.title)} · Ep ${s.episode}</button>`;
        }).join('')}</div>
      </div>
      <button class="btn btn-ghost btn-icon tb-close" data-act="dismiss-banner" aria-label="Ocultar aviso de hoy">✕</button>
    </div>`;
}

/* ================= Componentes ================= */
function heartBtn(id, cls = '') {
  const on = Boolean(state.anime[id] && state.anime[id].favorite);
  return `<button class="heart-btn ${cls}${on ? ' on' : ''}" data-act="fav" data-id="${id}" aria-pressed="${on}" aria-label="Favorito">${ICON.heart}</button>`;
}
function typeFilterHTML(ctx, typeKeys, customTags = []) {
  const active = ui.typeFilter[ctx];
  if (!typeKeys.length && !customTags.length) return '';
  const chip = (v, label, extra = '') => `<button class="chip sm${active === v || (!active && v === '') ? ' active' : ''}${extra}" data-act="type" data-ctx="${ctx}" data-v="${esc(v)}">${esc(label)}</button>`;
  return `<div class="chips type-chips" role="toolbar" aria-label="Filtrar por tipo">${chip('', 'Todo')}${typeKeys.map((k) => chip(k, TYPES[k].label, TYPES[k].demo ? ' demo' : '')).join('')}${customTags.map((t) => chip(`#${t}`, `#${t}`, ' custom')).join('')}</div>`;
}
function presentTypes(typeLists) {
  const set = new Set(); typeLists.forEach((t) => t.forEach((k) => set.add(k)));
  return TYPE_ORDER.filter((k) => set.has(k));
}
function matchFilter(ctx, types, customTags = []) {
  const f = ui.typeFilter[ctx]; if (!f) return true;
  if (f.startsWith('#')) return customTags.includes(f.slice(1));
  return types.includes(f);
}

function cardHTML(e, noAnim = false, i = 0) {
  const pct = e.episodes ? Math.min(100, (e.progress / e.episodes) * 100) : (e.progress ? 100 * e.progress / Math.max(e.progress, availableEpisodes(e) || e.progress) : 0);
  const avail = availableEpisodes(e);
  const behind = avail != null ? Math.max(0, avail - e.progress) : 0;
  const done = e.status === 'terminado';
  let sub = '';
  if (done) sub = e.rewatches ? `Visto ${e.rewatches + 1} veces` : '';
  else if (behind > 0) sub = `${behind} por ver`;
  else if (e.next && e.status === 'viendo') sub = 'Al día';
  const meta = e.next && !done
    ? `<span title="${esc(cap(fmtFull.format(new Date(e.next.airingAt * 1000))))}">${cdPill(e.next.airingAt, `Ep ${e.next.episode} ·`)}</span>`
    : (!done && e.mediaStatus ? `<span class="pill aired">${esc(MEDIA_STATUS[e.mediaStatus] || '')}</span>` : '');
  const tags = displayTypes(e.types).slice(0, 3).map(typeChip).join('') + e.customTags.slice(0, 2).map(customChip).join('');
  const actions = done
    ? `<span class="ep done-line">✓ Terminado${e.finishedAt ? ` el ${esc(fmtDate.format(new Date(e.finishedAt)))}${e.finishedApprox ? '*' : ''}` : ''}</span>`
    : `<span class="ep">Ep <b>${e.progress}</b> / ${e.episodes || '?'}</span>
       <button class="btn btn-sm btn-ghost btn-icon" data-act="minus" data-id="${e.id}" aria-label="Restar un episodio" ${e.progress ? '' : 'disabled'}>−</button>
       <button class="btn btn-sm btn-primary" data-act="plus" data-id="${e.id}" aria-label="Sumar un episodio">+1 ep</button>`;
  return `
  <article class="card${noAnim ? ' no-anim' : ''}" data-id="${e.id}" style="--tint:${esc(e.color)};animation-delay:${Math.min(i, 12) * 35}ms">
    <div class="cover" data-act="open" data-id="${e.id}">
      <img src="${esc(e.cover)}" alt="" loading="lazy" onload="this.classList.add('loaded')" onerror="this.style.display='none'">
    </div>
    <div class="card-body">
      <div class="card-top">
        <h3 class="card-title" data-act="open" data-id="${e.id}">${esc(e.title)}</h3>
        ${heartBtn(e.id, 'sm')}
      </div>
      <div class="card-meta">
        ${e.status ? `<span class="pill st-${e.status}">${STATUS[e.status]}</span>` : '<span class="pill">Sin estado</span>'}
        ${meta}
      </div>
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      <div class="card-meta">
        <button class="score${e.score ? '' : ' none'}" data-act="rate" data-id="${e.id}" aria-label="Puntuar">${e.score ? `★ ${e.score}<small>/10</small>` : '☆ Puntuar'}</button>
        ${sub ? `<span class="card-sub">· ${sub}</span>` : ''}
        ${e.notes.length ? `<span class="card-sub" title="Notas">· 📝 ${e.notes.length}</span>` : ''}
      </div>
      ${done ? '' : `<div class="progress" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></div>`}
      <div class="card-actions">${actions}</div>
    </div>
  </article>`;
}
function refreshCard(id) {
  const el = document.querySelector(`.card[data-id="${id}"]`);
  if (!el) return;
  if (!state.anime[id]) { el.remove(); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = cardHTML(state.anime[id], true).trim();
  const fresh = tmp.firstElementChild;
  const img = fresh.querySelector('img'); if (img) img.classList.add('loaded');
  el.replaceWith(fresh);
}
function posterHTML(m, i = 0, ctx = 'search') {
  const e = state.anime[m.id];
  const cover = (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || '';
  const badgeCls = m.status === 'RELEASING' ? 'live' : m.status === 'NOT_YET_RELEASED' ? 'countdown' : 'aired';
  const types = displayTypes(mediaTypes(m)).slice(0, 2);
  const addAct = ctx === 'home' ? 'add-season' : 'add';
  return `
  <div class="poster" style="animation-delay:${Math.min(i, 15) * 30}ms">
    <div class="cover" data-act="open" data-id="${m.id}">
      <img src="${esc(cover)}" alt="" loading="lazy" onload="this.classList.add('loaded')">
      ${m.status ? `<span class="pill ${badgeCls} badge">${esc(MEDIA_STATUS[m.status] || m.status)}</span>` : ''}
      ${m.averageScore ? `<span class="score-badge">★ ${(m.averageScore / 10).toFixed(1)}</span>` : ''}
      <div class="shade">${m.nextAiringEpisode ? cdPill(m.nextAiringEpisode.airingAt) : '<span></span>'}${heartBtn(m.id)}</div>
    </div>
    <h3 data-act="open" data-id="${m.id}">${esc(titleOf(m))}</h3>
    <div class="sub">${esc(seasonText(m))}</div>
    ${types.length ? `<div class="tags">${types.map(typeChip).join('')}</div>` : ''}
    ${e && e.status
      ? `<button class="btn btn-sm added" data-act="open" data-id="${m.id}">✓ ${STATUS[e.status]}</button>`
      : `<button class="btn btn-sm" data-act="${addAct}" data-id="${m.id}">${ICON.plus}${ctx === 'home' ? 'Lo estoy viendo' : 'Agregar'}</button>`}
  </div>`;
}
const skeletonPosters = (n = 10) => `<div class="poster-grid">${Array.from({ length: n }, () =>
  `<div class="poster"><div class="cover skel"></div><div class="skel skel-line" style="width:85%"></div><div class="skel skel-line" style="width:55%"></div></div>`).join('')}</div>`;
const skeletonCards = (n = 3) => `<div class="grid">${Array.from({ length: n }, () =>
  `<div class="card"><div class="cover skel"></div><div class="card-body"><div class="skel skel-line" style="width:80%;height:16px"></div><div class="skel skel-line" style="width:50%"></div><div class="skel skel-line" style="width:65%"></div></div></div>`).join('')}</div>`;
function errorBox(msg, act) { return `<div class="error-box"><span>⚠️ ${esc(msg)}</span><button class="btn btn-sm" data-act="${act}">Reintentar</button></div>`; }
function emptyHTML(art, title, text, cta = '') {
  return `<div class="empty"><div class="art" aria-hidden="true">${art}</div><h3>${title}</h3><p>${text}</p>${cta}</div>`;
}
function sortEntries(list, mode) {
  const nextAt = (e) => (e.next && e.status !== 'terminado' ? e.next.airingAt : Infinity);
  const by = {
    next: (a, b) => (nextAt(a) - nextAt(b)) || b.addedAt - a.addedAt,
    finished: (a, b) => (b.finishedAt || 0) - (a.finishedAt || 0),
    recent: (a, b) => b.addedAt - a.addedAt,
    title: (a, b) => a.title.localeCompare(b.title, LOCALE),
    score: (a, b) => b.score - a.score || a.title.localeCompare(b.title, LOCALE),
  }[mode] || ((a, b) => b.addedAt - a.addedAt);
  return list.sort(by);
}

/* ================= Vista: Inicio / Temporada ================= */
function seasonWatching() {
  return entries().filter((e) => e.status === 'viendo' && (e.seasonPick === SEASON_NOW.key || (e.season === SEASON_NOW.season && e.seasonYear === SEASON_NOW.year) || e.mediaStatus === 'RELEASING'));
}
function renderHome(view) {
  const watching = sortEntries(seasonWatching(), 'next');
  const pend = entries().filter((e) => e.status === 'pendiente').length;
  view.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">Temporada ${esc(SEASON_NOW.label)}</p>
        <h1>¡Hola! <span class="wave" aria-hidden="true">👋</span></h1>
        <p>Lo que estás viendo y lo nuevo de la temporada.</p>
      </div>
    </header>
    <section class="block">
      <div class="block-head">
        <h2>Viendo esta temporada <span class="count-badge">${watching.length}</span></h2>
        ${watching.length ? '<a class="link" href="#/listas">Ver todo →</a>' : ''}
      </div>
      ${watching.length ? `<div class="grid">${watching.map((e, i) => cardHTML(e, false, i)).join('')}</div>`
        : emptyHTML('🌸', 'Elige qué verás esta temporada', `Abajo están los animes de ${esc(SEASON_NOW.label)}. Toca <b>Lo estoy viendo</b> y aparecerán aquí con su próximo episodio.`)}
    </section>
    <button class="pick-cta" data-act="pick">
      <span class="pick-icon" aria-hidden="true">🎲</span>
      <span><b>¿Qué veo hoy?</b><small>${pend ? `Te elegimos algo de tus ${pend} pendientes` : 'Guarda animes como Pendiente y te sugerimos uno'}</small></span>
      <span class="chev" aria-hidden="true">›</span>
    </button>
    <section class="block">
      <div class="block-head"><h2>Explorar ${esc(SEASON_NOW.label)}</h2><span class="card-sub">Por popularidad</span></div>
      <div id="seasonResults"></div>
    </section>`;
  renderSeasonResults();
  if (!ui.season && !ui.seasonLoading && !ui.seasonError) loadSeason();
}
async function loadSeason() {
  ui.seasonLoading = true;
  try { ui.season = await fetchSeason(); ui.seasonError = null; } catch (e) { ui.seasonError = e.message; }
  ui.seasonLoading = false;
  if (ui.route === 'inicio') renderSeasonResults();
}
function renderSeasonResults() {
  const box = $('#seasonResults'); if (!box) return;
  if (ui.seasonError) { box.innerHTML = errorBox(ui.seasonError, 'retry-season'); return; }
  if (!ui.season) { box.innerHTML = skeletonPosters(10); return; }
  const all = ui.season;
  const shown = all.filter((m) => matchFilter('home', mediaTypes(m)));
  box.innerHTML = typeFilterHTML('home', presentTypes(all.map(mediaTypes))) +
    (ui.typeFilter.home ? `<p class="result-count">${shown.length} de ${all.length} animes</p>` : '') +
    (shown.length ? `<div class="poster-grid">${shown.map((m, i) => posterHTML(m, i, 'home')).join('')}</div>`
      : emptyHTML('🔎', 'Nada de ese tipo esta temporada', 'Prueba con otra clasificación.'));
}

/* ================= Vista: Mis listas ================= */
const BUILTIN_TABS = [
  { k: 'viendo', label: 'Viendo', emoji: '📺' },
  { k: 'pendiente', label: 'Pendientes', emoji: '🕒' },
  { k: 'terminado', label: 'Vistos', emoji: '✅' },
  { k: 'favoritos', label: 'Favoritos', emoji: '💖' },
];
function tabEntries(tab) {
  if (tab === 'favoritos') return entries().filter((e) => e.favorite);
  if (tab.startsWith('list:')) { const id = tab.slice(5); return entries().filter((e) => e.lists.includes(id)); }
  return entries().filter((e) => e.status === tab);
}
function renderLists(view) {
  if (ui.listTab.startsWith('list:') && !state.lists[ui.listTab.slice(5)]) ui.listTab = 'viendo';
  const all = entries();
  const vistos = all.filter((e) => e.status === 'terminado').length;
  const tabs = BUILTIN_TABS.map((t) => `<button class="chip tab${ui.listTab === t.k ? ' active' : ''}" data-act="list-tab" data-v="${t.k}">${t.emoji} ${t.label} <span class="count">${tabEntries(t.k).length}</span></button>`).join('') +
    Object.values(state.lists).sort((a, b) => a.createdAt - b.createdAt).map((l) => `<button class="chip tab custom-list${ui.listTab === `list:${l.id}` ? ' active' : ''}" style="--lc:${esc(l.color)}" data-act="list-tab" data-v="list:${l.id}">${esc(l.emoji)} ${esc(l.name)} <span class="count">${tabEntries(`list:${l.id}`).length}</span></button>`).join('') +
    `<button class="chip tab new" data-act="new-list">${ICON.plus} Nueva lista</button>`;
  view.innerHTML = `
    <header class="page-head">
      <div><h1>Mis <span class="grad-text">listas</span></h1>
      <p>${all.length ? `${all.filter((e) => e.status).length} en seguimiento · ${vistos} vistos · ${Object.keys(state.lists).length} listas propias` : 'Todo lo que ves, quieres ver y ya viste.'}</p></div>
    </header>
    <div class="chips tabs" role="tablist" aria-label="Listas">${tabs}</div>
    <div class="search-box sm">
      ${ICON.search}
      <input id="listSearch" type="search" placeholder="Buscar en tus listas…" autocomplete="off" value="${esc(ui.listQuery)}" aria-label="Buscar en tus listas">
    </div>
    <div id="listResults"></div>`;
  const act = view.querySelector('.chips.tabs .active');
  if (act) { const c = act.parentElement, cr = c.getBoundingClientRect(), ar = act.getBoundingClientRect(); c.scrollLeft += (ar.left - cr.left) - (cr.width - ar.width) / 2; }
  const input = $('#listSearch');
  input.addEventListener('input', () => { ui.listQuery = input.value; renderListResults(); });
  renderListResults();
}
function renderListResults() {
  const box = $('#listResults'); if (!box) return;
  const q = ui.listQuery.trim().toLowerCase();
  let base = q ? entries() : tabEntries(ui.listTab);
  if (q) base = base.filter((e) => [e.title, e.titleEn, e.titleRomaji, ...e.customTags].join(' ').toLowerCase().includes(q));
  const filtered = base.filter((e) => matchFilter('lists', e.types, e.customTags));
  const smart = ui.listTab === 'terminado' ? 'finished' : ui.listTab === 'viendo' ? 'next' : 'recent';
  const items = sortEntries(filtered, ui.sort === 'smart' ? smart : ui.sort);
  const tab = ui.listTab;
  const l = tab.startsWith('list:') ? state.lists[tab.slice(5)] : null;
  const head = l ? `<div class="list-head" style="--lc:${esc(l.color)}"><span class="lh-emoji">${esc(l.emoji)}</span><div><b>${esc(l.name)}</b><small>${base.length} anime</small></div><button class="btn btn-sm" data-act="edit-list" data-v="${l.id}">${ICON.edit} Editar</button></div>` : '';
  const toolbar = base.length ? `<div class="list-toolbar">
      ${typeFilterHTML('lists', presentTypes(base.map((e) => e.types)), [...new Set(base.flatMap((e) => e.customTags))])}
      <select class="select" data-act="sort" aria-label="Ordenar">
        ${[['smart', tab === 'terminado' ? 'Terminados recientes' : tab === 'viendo' ? 'Próximo episodio' : 'Agregados recientes'], ['title', 'Título (A-Z)'], ['score', 'Mi puntuación'], ['recent', 'Agregados recientes']]
          .filter((o, i, arr) => arr.findIndex((x) => x[1] === o[1]) === i)
          .map(([v, t]) => `<option value="${v}" ${ui.sort === v ? 'selected' : ''}>${t}</option>`).join('')}
      </select></div>` : '';
  let body;
  if (q && !items.length) body = emptyHTML('🔍', 'Sin coincidencias', `No hay nada con “${esc(ui.listQuery)}” en tus listas.`, '<a class="btn" href="#/buscar">Buscar en AniList</a>');
  else if (!base.length) {
    const E = {
      viendo: ['🍿', 'No estás viendo nada todavía', 'Elige algo de la temporada o búscalo por nombre.', '<a class="btn btn-primary" href="#/inicio">Explorar temporada</a>'],
      pendiente: ['🕒', 'Sin pendientes', 'Guarda aquí lo que quieres ver después. Así <b>¿Qué veo hoy?</b> podrá sugerirte algo.', '<a class="btn" href="#/buscar">Buscar animes</a>'],
      terminado: ['🏁', 'Aún no terminas ningún anime', 'Cuando marques el último episodio o toques <b>Terminado</b>, aparecerá aquí con su fecha.', ''],
      favoritos: ['💖', 'Sin favoritos', 'Toca el corazón en cualquier anime para guardarlo aquí.', ''],
    }[tab] || ['📂', 'Esta lista está vacía', 'Abre la ficha de un anime y, en <b>Mis listas</b>, agrégalo aquí.', '<a class="btn" href="#/buscar">Buscar animes</a>'];
    body = emptyHTML(...E);
  } else if (!items.length) body = emptyHTML('🏷️', 'Nada con ese filtro', 'Prueba con otra clasificación.');
  else body = `${q ? `<p class="result-count">${items.length} resultado${items.length === 1 ? '' : 's'} en todas tus listas</p>` : ''}<div class="grid">${items.map((e, i) => cardHTML(e, false, i)).join('')}</div>`;
  box.innerHTML = (q ? '' : head) + toolbar + body;
}

/* ================= Vista: Buscar ================= */
function renderSearch(view) {
  view.innerHTML = `
    <header class="page-head"><div><h1>Buscar <span class="grad-text">anime</span></h1><p>Busca en todo el catálogo de AniList.</p></div></header>
    <div class="search-box">
      ${ICON.search}
      <input id="searchInput" type="search" placeholder="Ej. Frieren, One Piece, Dandadan…" autocomplete="off" enterkeyhint="search" value="${esc(ui.search.q)}" aria-label="Buscar anime">
      <button class="btn btn-ghost btn-icon clear" data-act="clear-search" aria-label="Limpiar" ${ui.search.q ? '' : 'hidden'}>✕</button>
    </div>
    <div id="results"></div>`;
  const input = $('#searchInput');
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    $('[data-act="clear-search"]').hidden = !input.value;
    t = setTimeout(() => doSearch(input.value.trim()), 380);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(t); doSearch(input.value.trim()); input.blur(); } });
  if (matchMedia('(min-width: 900px)').matches) input.focus();
  renderResults();
  if (!ui.search.q && !ui.trending && !ui.trendingError) loadTrending();
}
async function loadTrending() {
  try { ui.trending = await searchAnime(''); ui.trendingError = null; } catch (e) { ui.trendingError = e.message; }
  if (ui.route === 'buscar') renderResults();
}
async function doSearch(q) {
  ui.search.q = q; ui.typeFilter.search = null;
  if (!q) { ui.search.results = null; ui.search.error = null; renderResults(); if (!ui.trending) loadTrending(); return; }
  const seq = ++ui.search.seq;
  ui.search.loading = true; ui.search.error = null; renderResults();
  try { const res = await searchAnime(q); if (seq !== ui.search.seq) return; ui.search.results = res; }
  catch (e) { if (seq !== ui.search.seq) return; ui.search.error = e.message; ui.search.results = null; }
  ui.search.loading = false;
  if (ui.route === 'buscar') renderResults();
}
function renderResults() {
  const box = $('#results'); if (!box) return;
  const s = ui.search;
  const grid = (list, title) => {
    const shown = list.filter((m) => matchFilter('search', mediaTypes(m)));
    return `<div class="section-title"><span>${title}</span>${ui.typeFilter.search ? `<span>${shown.length} de ${list.length}</span>` : ''}</div>` +
      typeFilterHTML('search', presentTypes(list.map(mediaTypes))) +
      (shown.length ? `<div class="poster-grid">${shown.map((m, i) => posterHTML(m, i)).join('')}</div>` : emptyHTML('🏷️', 'Nada con ese filtro', 'Prueba con otra clasificación.'));
  };
  if (!s.q) {
    if (ui.trendingError) box.innerHTML = errorBox(ui.trendingError, 'retry-trending');
    else if (!ui.trending) box.innerHTML = `<div class="section-title"><span>🔥 Populares en emisión</span></div>` + skeletonPosters();
    else box.innerHTML = grid(ui.trending, '🔥 Populares en emisión');
    return;
  }
  if (s.loading) { box.innerHTML = `<div class="section-title"><span>Buscando “${esc(s.q)}”…</span></div>` + skeletonPosters(); return; }
  if (s.error) { box.innerHTML = errorBox(s.error, 'retry-search'); return; }
  if (!s.results || !s.results.length) { box.innerHTML = emptyHTML('🔍', 'Sin resultados', `No encontramos “${esc(s.q)}”. Prueba con el nombre en japonés (romaji) o en inglés.`); return; }
  box.innerHTML = grid(s.results, `${s.results.length} resultados`);
}

/* ================= Vista: Calendario ================= */
const calIds = () => entries().filter((e) => e.status === 'viendo' || e.status === 'pendiente').map((e) => e.id).sort((a, b) => a - b);
function weekKey() {
  const ws = weekStart(ui.weekOffset).getTime();
  return ui.calMode === 'all' ? `all:${ws}` : `mine:${ws}:${calIds().join(',')}`;
}
async function loadWeek() {
  const key = weekKey();
  const cached = ui.weekCache[key];
  if (cached && Date.now() - cached.at < 15 * 60 * 1000) return;
  const ws = weekStart(ui.weekOffset);
  const start = Math.floor(ws.getTime() / 1000) - 1;
  const endD = new Date(ws); endD.setDate(endD.getDate() + 7);
  const end = Math.floor(endD.getTime() / 1000);
  let ids = null;
  if (ui.calMode === 'mine') { ids = calIds(); if (!ids.length) { ui.weekCache[key] = { at: Date.now(), items: [] }; return; } }
  ui.weekLoading = true; ui.weekError = null;
  try {
    let items = [];
    if (ids) { for (let i = 0; i < ids.length; i += 50) items = items.concat(await fetchSchedules(start, end, ids.slice(i, i + 50))); }
    else items = await fetchSchedules(start, end, null);
    items.sort((a, b) => a.airingAt - b.airingAt);
    ui.weekCache[key] = { at: Date.now(), items };
  } catch (e) { ui.weekError = e.message; }
  ui.weekLoading = false;
  if (ui.route === 'calendario' && weekKey() === key) renderCalendar($('#view'));
}
function slotHTML(s, isNext, i) {
  const m = s.media;
  const mine = state.anime[m.id] && state.anime[m.id].status ? state.anime[m.id] : null;
  const tp = timeParts(s.airingAt);
  const past = s.airingAt <= nowSec() - 3 * 3600;
  const cover = (m.coverImage && (m.coverImage.large || m.coverImage.extraLarge)) || '';
  let act = '';
  if (ui.calMode === 'all') act = mine ? `<button class="btn btn-sm added" data-act="open" data-id="${m.id}">✓ En lista</button>` : `<button class="btn btn-sm" data-act="add" data-id="${m.id}">+ Agregar</button>`;
  return `
  <div class="slot${past ? ' is-past' : ''}${isNext ? ' is-next' : ''}" style="animation-delay:${Math.min(i, 10) * 30}ms">
    <div class="time">${esc(tp.hm)}<small>${esc(tp.ap)}</small></div>
    <div class="thumb" data-act="open" data-id="${m.id}"><img src="${esc(cover)}" alt="" loading="lazy"></div>
    <div class="info">
      <h4 data-act="open" data-id="${m.id}">${esc(titleOf(m))}</h4>
      <div class="row">
        <span class="pill aired">Ep ${s.episode}${m.episodes ? `/${m.episodes}` : ''}</span>
        ${cdPill(s.airingAt)}
        ${mine && ui.calMode === 'mine' ? `<span class="pill st-${mine.status}">${STATUS[mine.status]}</span>` : ''}
      </div>
    </div>
    ${act ? `<div class="act">${act}</div>` : ''}
  </div>`;
}
function renderCalendar(view) {
  const ws = weekStart(ui.weekOffset);
  const todayIdx = ui.weekOffset === 0 ? dayIdx(new Date()) : -1;
  if (ui.selectedDay == null) ui.selectedDay = todayIdx >= 0 ? todayIdx : 0;
  const we = new Date(ws); we.setDate(we.getDate() + 6);
  const cached = ui.weekCache[weekKey()];
  const loading = !cached && !ui.weekError;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return d; });
  const byDay = days.map(() => []);
  if (cached) cached.items.forEach((s) => { const idx = Math.round((startOfDay(new Date(s.airingAt * 1000)) - ws) / 86400000); if (idx >= 0 && idx < 7) byDay[idx].push(s); });
  const nextItem = cached && cached.items.find((s) => s.airingAt > nowSec());
  // en móvil: si hoy no sale nada de tu lista, muestra el siguiente día con episodios
  if (cached && !ui.daySetByUser && todayIdx >= 0 && !byDay[todayIdx].length) {
    const nextDay = byDay.findIndex((l, i) => i > todayIdx && l.length);
    ui.selectedDay = nextDay >= 0 ? nextDay : todayIdx;
  }
  const strip = days.map((d, i) => `<button class="day-tab${i === todayIdx ? ' today' : ''}${i === ui.selectedDay ? ' active' : ''}" data-act="day" data-v="${i}" aria-label="${DAYS[i]} ${d.getDate()}">
      <span class="dn">${i === todayIdx ? 'Hoy' : DAYS_SHORT[i]}</span><span class="dd">${d.getDate()}</span>
      <span class="dc">${'<i></i>'.repeat(Math.min(3, byDay[i].length))}</span></button>`).join('');
  const noList = ui.calMode === 'mine' && !calIds().length;
  let body;
  if (noList) {
    body = emptyHTML('📅', 'Aún no sigues ningún anime en emisión', 'Agrega lo que estás viendo y aquí verás qué día y a qué hora sale cada episodio.',
      '<div class="row-center"><button class="btn btn-primary" data-act="cal-mode" data-v="all">Ver todos los estrenos</button><a class="btn" href="#/inicio">Explorar temporada</a></div>');
  } else if (ui.weekError && !cached) body = errorBox(ui.weekError, 'retry-week');
  else {
    body = `<div class="week${ui.calMode === 'all' ? ' compact' : ''}">${days.map((d, i) => {
      const list = byDay[i];
      let inner;
      if (loading) inner = Array.from({ length: 3 }, () => `<div class="slot"><div class="skel" style="width:46px;height:68px;flex:0 0 auto"></div><div class="info"><div class="skel skel-line" style="width:80%"></div><div class="skel skel-line" style="width:45%"></div></div></div>`).join('');
      else if (!list.length) inner = `<div class="day-empty">${ui.calMode === 'mine' ? 'Sin episodios de tu lista' : 'Sin estrenos'}</div>`;
      else inner = list.map((s, j) => slotHTML(s, nextItem && s.id === nextItem.id, j)).join('');
      return `<section class="day-col${i === todayIdx ? ' today' : ''}${i === ui.selectedDay ? ' active' : ''}" aria-label="${DAYS[i]}">
        <div class="day-col-head"><b>${DAYS_SHORT[i]}${i === todayIdx ? '<span class="today-tag">HOY</span>' : ''}</b><span>${d.getDate()} · ${list.length}</span></div>${inner}</section>`;
    }).join('')}</div>`;
  }
  const total = cached ? cached.items.length : 0;
  view.innerHTML = `
    <header class="page-head"><div><h1><span class="grad-text">Calendario</span> semanal</h1>
      <p>Horarios en tu zona (${esc(TZ.replace(/_/g, ' '))})${cached && !noList ? ` · ${total} ${total === 1 ? 'episodio' : 'episodios'} esta semana` : ''}</p></div></header>
    <div class="cal-toolbar">
      <div class="segmented" role="tablist" aria-label="Qué mostrar">
        <button class="${ui.calMode === 'mine' ? 'active' : ''}" data-act="cal-mode" data-v="mine">Mis animes</button>
        <button class="${ui.calMode === 'all' ? 'active' : ''}" data-act="cal-mode" data-v="all">Todos en emisión</button>
      </div>
      <span class="spacer"></span>
      <div class="week-nav">
        <button class="btn btn-sm btn-icon" data-act="week" data-v="-1" aria-label="Semana anterior">‹</button>
        <span class="week-label">${esc(fmtDayMonth.format(ws))} – ${esc(fmtDayMonth.format(we))}</span>
        <button class="btn btn-sm btn-icon" data-act="week" data-v="1" aria-label="Semana siguiente">›</button>
        ${ui.weekOffset !== 0 ? '<button class="btn btn-sm" data-act="week" data-v="0">Hoy</button>' : ''}
      </div>
    </div>
    ${noList ? '' : `<div class="day-strip">${strip}</div>`}
    ${body}`;
  if (!cached && !ui.weekLoading && !ui.weekError && !noList) loadWeek();
}

/* ================= Vista: Perfil (estadísticas + ajustes) ================= */
function computeStats() {
  const all = entries();
  const vistos = all.filter((e) => e.status === 'terminado');
  let eps = 0, mins = 0;
  all.forEach((e) => {
    const n = e.progress + (e.rewatches || 0) * (e.episodes || e.progress);
    eps += n; mins += n * (e.duration || 24);
  });
  const scored = all.filter((e) => e.score > 0);
  const avg = scored.length ? scored.reduce((a, e) => a + e.score, 0) / scored.length : 0;
  const tracked = all.filter((e) => e.status === 'terminado' || e.status === 'viendo' || e.favorite);
  const genreCount = {}, demoCount = {};
  tracked.forEach((e) => displayTypes(e.types).forEach((k) => { (TYPES[k].demo ? demoCount : genreCount)[k] = ((TYPES[k].demo ? demoCount : genreCount)[k] || 0) + 1; }));
  const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topDemo = Object.entries(demoCount).sort((a, b) => b[1] - a[1])[0];
  const dist = Array.from({ length: 10 }, (_, i) => scored.filter((e) => e.score === i + 1).length);
  const year = new Date().getFullYear();
  return {
    total: all.filter((e) => e.status).length, vistos: vistos.length, eps, hours: Math.round(mins / 60), avg, scoredN: scored.length,
    topGenres, topDemo, dist, favs: all.filter((e) => e.favorite).length,
    status: Object.keys(STATUS).map((k) => [k, all.filter((e) => e.status === k).length]),
    thisYear: vistos.filter((e) => e.finishedAt && new Date(e.finishedAt).getFullYear() === year && !e.finishedApprox).length,
    notes: all.reduce((a, e) => a + e.notes.length, 0),
  };
}
function barsHTML(rows, max, cls = '') {
  return `<div class="bars ${cls}">${rows.map(([label, v]) => `<div class="bar-row"><span class="bl">${esc(label)}</span><span class="bt"><i style="width:${max ? Math.max(v ? 4 : 0, (v / max) * 100) : 0}%"></i></span><span class="bv">${v}</span></div>`).join('')}</div>`;
}
function renderProfile(view) {
  const seg = `<div class="segmented big" role="tablist">
      <button class="${ui.profileTab === 'stats' ? 'active' : ''}" data-act="profile-tab" data-v="stats">📊 Estadísticas</button>
      <button class="${ui.profileTab === 'ajustes' ? 'active' : ''}" data-act="profile-tab" data-v="ajustes">🔔 Alertas y ajustes</button></div>`;
  view.innerHTML = `<header class="page-head"><div><h1>Tu <span class="grad-text">perfil</span></h1><p>Tus números de anime y la configuración de la app.</p></div></header>${seg}<div id="profileBody" class="profile-body"></div>`;
  const body = $('#profileBody');
  if (ui.profileTab === 'ajustes') { renderSettings(body); return; }
  const s = computeStats();
  if (!s.total && !s.favs) {
    body.innerHTML = emptyHTML('📊', 'Tus estadísticas aparecerán aquí', 'Agrega animes, marca episodios y puntúa lo que termines. Aquí verás cuántas horas llevas, tu género favorito y más.', '<a class="btn btn-primary" href="#/inicio">Empezar</a>');
    return;
  }
  const fav = s.topGenres[0];
  const maxG = s.topGenres.length ? s.topGenres[0][1] : 0;
  const maxD = Math.max(...s.dist);
  const maxS = Math.max(...s.status.map((x) => x[1]));
  body.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><span class="sv">${s.vistos}</span><span class="sl">Anime vistos</span>${s.thisYear ? `<small>${s.thisYear} este año</small>` : ''}</div>
      <div class="stat"><span class="sv">${s.eps.toLocaleString(LOCALE)}</span><span class="sl">Episodios vistos</span></div>
      <div class="stat"><span class="sv">${s.hours.toLocaleString(LOCALE)}<em> h</em></span><span class="sl">Horas estimadas</span><small>≈ ${(s.hours / 24).toFixed(1)} días</small></div>
      <div class="stat"><span class="sv">${s.avg ? s.avg.toFixed(1) : '—'}<em>${s.avg ? ' ★' : ''}</em></span><span class="sl">Puntuación promedio</span><small>${s.scoredN} puntuados</small></div>
      <div class="stat wide"><span class="sv sm">${fav ? esc(TYPES[fav[0]].label) : '—'}</span><span class="sl">Género favorito</span>${s.topDemo ? `<small>Demografía: ${esc(TYPES[s.topDemo[0]].label)}</small>` : ''}</div>
      <div class="stat"><span class="sv">${s.favs}</span><span class="sl">Favoritos</span><small>${s.notes} notas</small></div>
    </div>
    <div class="panels three">
      <section class="panel"><h2>Géneros que más ves</h2>${s.topGenres.length ? barsHTML(s.topGenres.map(([k, v]) => [TYPES[k].label, v]), maxG) : '<p>Aún no hay suficientes datos.</p>'}</section>
      <section class="panel"><h2>Tus puntuaciones</h2>${s.scoredN ? `<div class="histo">${s.dist.map((v, i) => `<div class="hcol" title="${v} con ${i + 1}"><span class="hv">${v || ''}</span><i style="height:${maxD ? (v / maxD) * 100 : 0}%"></i><span class="hl">${i + 1}</span></div>`).join('')}</div>` : '<p>Puntúa lo que veas para ver tu distribución.</p>'}</section>
      <section class="panel"><h2>Por estado</h2>${barsHTML(s.status.map(([k, v]) => [k === 'terminado' ? 'Vistos' : STATUS[k], v]), maxS, 'status')}</section>
    </div>`;
}
function permState() {
  if (!('Notification' in window)) return { k: 'unsupported', cls: 'off', text: 'Tu navegador no admite notificaciones' };
  const p = Notification.permission;
  if (p === 'granted') return state.settings.notify ? { k: 'on', cls: 'on', text: 'Alertas activadas' } : { k: 'paused', cls: 'ask', text: 'Permiso concedido · alertas en pausa' };
  if (p === 'denied') return { k: 'denied', cls: 'off', text: 'Bloqueadas en el navegador' };
  return { k: 'default', cls: 'ask', text: 'Aún no das permiso' };
}
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
function renderSettings(box) {
  const ps = permState();
  const ups = upcomingEpisodes().filter((s) => s.airingAt > nowSec() && followedStatuses().includes(state.anime[s.mediaId].status)).slice(0, 10);
  let permBtn = '';
  if (ps.k === 'default') permBtn = '<button class="btn btn-primary" data-act="ask-perm">🔔 Activar notificaciones</button>';
  else if (ps.k === 'denied') permBtn = '<span class="card-sub">Permite las notificaciones de este sitio en la configuración del navegador (candado junto a la dirección).</span>';
  else if (ps.k !== 'unsupported') permBtn = '<button class="btn" data-act="test-notif">Probar notificación</button>';
  let install;
  if (isStandalone()) install = '<p>✅ AniAgenda ya está instalada en este dispositivo.</p>';
  else if (ui.installEvt) install = '<p>Ábrela como app desde tu pantalla de inicio, sin barra del navegador.</p><button class="btn btn-primary" data-act="install">📲 Instalar app</button>';
  else install = `<p>${isIOS() ? 'En iPhone/iPad (Safari): <b>Compartir</b> → <b>Agregar a inicio</b>. Desde iOS 16.4 las apps del inicio pueden mostrar notificaciones.' : 'En Android (Chrome): menú <b>⋮</b> → <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.'}</p><p class="card-sub">Para instalarla en el teléfono debe estar publicada con HTTPS (Netlify Drop o GitHub Pages).</p>`;
  box.innerHTML = `
    <div class="panels">
      <div>
        <section class="panel">
          <h2>Notificaciones</h2>
          <div class="row" style="justify-content:space-between;margin:8px 0 14px"><span class="status-dot ${ps.cls}">${ps.text}</span>${permBtn}</div>
          <div class="field"><div>Avisarme de nuevos episodios<small>Viendo${state.settings.includePending ? ' y Pendiente' : ''}</small></div>
            <label class="switch"><input type="checkbox" data-act="toggle-notify" ${state.settings.notify ? 'checked' : ''} ${ps.k === 'unsupported' || ps.k === 'denied' ? 'disabled' : ''} aria-label="Activar alertas"><span></span></label></div>
          <div class="field"><div>¿Cuándo avisar?<small>Respecto a la hora de estreno en Japón</small></div>
            <select class="select" data-act="lead" aria-label="Anticipación">${[[0, 'Al salir'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 h antes']].map(([v, l]) => `<option value="${v}" ${state.settings.lead === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><div>Incluir “Pendiente”<small>Si no, solo avisamos de lo que estás viendo</small></div>
            <label class="switch"><input type="checkbox" data-act="toggle-pending" ${state.settings.includePending ? 'checked' : ''} aria-label="Incluir pendientes"><span></span></label></div>
          <div class="note" style="margin-top:12px">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>
            <div><b>Importante:</b> las alertas solo llegan mientras AniAgenda está abierta (en una pestaña o como app instalada que el sistema no haya cerrado). Revisamos cada 30 segundos. Si cierras el navegador o el teléfono suspende la app, no llegarán; al volver verás el aviso “Hoy sale…”. Esta versión no usa un servidor de notificaciones push.</div>
          </div>
        </section>
        <section class="panel"><h2>Instalar en tu teléfono</h2>${install}</section>
        <section class="panel">
          <h2>Tus datos</h2>
          <p>Todo se guarda solo en este navegador. Haz un respaldo para pasarlo a otro dispositivo (también acepta respaldos de la versión 1).</p>
          <div class="row">
            <button class="btn" data-act="export">⬇️ Exportar respaldo</button>
            <label class="btn" tabindex="0">⬆️ Importar<input type="file" accept="application/json,.json" data-act="import" hidden></label>
          </div>
          ${state.migratedFrom ? '<p class="card-sub" style="margin-top:10px">✓ Tus datos de la versión 1 se migraron a la versión 2 (se conserva una copia de respaldo en el navegador).</p>' : ''}
        </section>
      </div>
      <section class="panel">
        <h2>Próximas alertas</h2>
        <p>${ups.length ? 'Episodios de tu lista en los próximos días.' : 'Cuando sigas animes en emisión, aquí verás sus próximos episodios.'}</p>
        ${ups.length ? `<div class="upcoming">${ups.map((s) => { const e = state.anime[s.mediaId]; return `<button class="up-item" data-act="open" data-id="${e.id}"><img src="${esc(e.coverSmall)}" alt="" loading="lazy"><div class="t"><b>${esc(e.title)}</b><span>Ep ${s.episode} · ${esc(cap(fmtFull.format(new Date(s.airingAt * 1000))))}</span></div>${cdPill(s.airingAt)}</button>`; }).join('')}</div>` : '<a class="btn" href="#/inicio">Explorar temporada</a>'}
      </section>
    </div>`;
}

/* ================= Notificaciones ================= */
async function showNotification(title, body, opts = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const options = { body, icon: opts.icon || 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: opts.tag, data: { url: './#/calendario' }, renotify: Boolean(opts.tag) };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.showNotification(title, options); return true; }
    }
    new Notification(title, options);
    return true;
  } catch (e) { console.warn('No se pudo mostrar la notificación', e); return false; }
}
function checkAlerts() {
  const cutoff = Date.now() - 14 * 86400000;
  Object.keys(state.notified).forEach((k) => { if (state.notified[k] < cutoff) delete state.notified[k]; });
  if (!state.settings.notify) return;
  const now = nowSec();
  const lead = (state.settings.lead || 0) * 60;
  let changed = false;
  upcomingEpisodes().forEach((s) => {
    const e = state.anime[s.mediaId];
    if (!e || !followedStatuses().includes(e.status)) return;
    const k = `${s.mediaId}-${s.episode}`;
    if (state.notified[k]) return;
    if (now >= s.airingAt - lead && now <= s.airingAt + 20 * 60) {
      state.notified[k] = Date.now(); changed = true;
      const body = now >= s.airingAt ? `¡Ya salió el episodio ${s.episode}!` : `El episodio ${s.episode} sale ${cdInfo(s.airingAt).text} (${fmtTime.format(new Date(s.airingAt * 1000))})`;
      showNotification(e.title, body, { icon: e.coverSmall, tag: k });
      toast(`🔔 <b>${esc(e.title)}</b> · ${esc(body)}`, { img: e.coverSmall, timeout: 8000 });
    }
  });
  if (changed) save();
}
async function askPermission() {
  if (!('Notification' in window)) return;
  const p = await Notification.requestPermission();
  if (p === 'granted') {
    state.settings.notify = true; save();
    showNotification('¡Alertas activadas!', 'Te avisaremos cuando salgan nuevos episodios mientras AniAgenda esté abierta.', { tag: 'welcome' });
    toast('🔔 Alertas activadas'); checkAlerts();
  } else if (p === 'denied') toast('Notificaciones bloqueadas por el navegador');
  render();
}

/* ================= Ficha (hoja de detalle) ================= */
function openSheet(id) {
  closeDialog();
  ui.sheetId = Number(id); ui.editingNote = null;
  renderSheet();
  $('#sheetBackdrop').hidden = false;
  const sh = $('#sheet');
  sh.hidden = false; sh.scrollTop = 0;
  sh.style.animation = 'none'; void sh.offsetWidth; sh.style.animation = '';
  document.body.style.overflow = 'hidden';
  setTimeout(() => { const b = $('.sheet-close', sh); b && b.focus({ preventScroll: true }); }, 50);
}
function closeSheet() {
  if (ui.sheetId == null) return;
  ui.sheetId = null; ui.editingNote = null;
  $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true;
  document.body.style.overflow = '';
}
function sec(key, title, count, body) {
  return `<details class="sec" data-sec="${key}" ${ui.openSecs.has(key) ? 'open' : ''}>
    <summary><span>${title}</span>${count ? `<span class="count">${count}</span>` : ''}<span class="chev" aria-hidden="true">›</span></summary>
    <div class="sec-body">${body}</div></details>`;
}
function rateGrid(current, act = 'score') {
  return `<div class="rate-grid" role="group" aria-label="Puntuación del 1 al 10">${Array.from({ length: 10 }, (_, i) => `<button class="${current >= i + 1 ? 'fill' : ''}${current === i + 1 ? ' cur' : ''}" data-act="${act}" data-v="${i + 1}" aria-label="${i + 1} de 10" aria-pressed="${current === i + 1}">${i + 1}</button>`).join('')}</div>`;
}
function noteHTML(n) {
  if (ui.editingNote === n.id) {
    return `<li class="note-item editing"><form data-form="note-edit" data-v="${n.id}">
      <textarea name="text" rows="3" maxlength="2000" aria-label="Editar nota">${esc(n.text)}</textarea>
      <div class="note-form-row"><label class="ep-field">Ep <input name="ep" type="number" min="1" inputmode="numeric" value="${n.ep || ''}" placeholder="—"></label>
      <span class="spacer"></span><button class="btn btn-sm btn-ghost" type="button" data-act="note-cancel">Cancelar</button><button class="btn btn-sm btn-primary" type="submit">Guardar</button></div></form></li>`;
  }
  return `<li class="note-item" data-note="${n.id}">
    <div class="note-meta">${n.ep ? `<span class="pill ep-pill">Ep ${n.ep}</span>` : ''}<time datetime="${new Date(n.createdAt).toISOString()}">${esc(fmtDateTime.format(new Date(n.createdAt)))}</time>${n.updatedAt && n.updatedAt - n.createdAt > 1000 ? ' · editada' : ''}</div>
    <p>${esc(n.text)}</p>
    <div class="note-actions"><button class="btn btn-sm btn-ghost" data-act="note-edit" data-v="${n.id}">${ICON.edit} Editar</button><button class="btn btn-sm btn-ghost danger" data-act="note-del" data-v="${n.id}">${ICON.trash} Eliminar</button></div></li>`;
}
function renderSheet() {
  const id = ui.sheetId; if (id == null) return;
  const sh = $('#sheet'); const scroll = sh.scrollTop;
  const it = state.anime[id];
  const m = ui.mediaCache[id];
  const e = it || (m && normalizeEntry({ ...mediaFields(m), status: null }));
  if (!e) { closeSheet(); return; }
  const tracked = Boolean(it && it.status);
  const types = displayTypes(e.types);
  const lists = Object.values(state.lists).sort((a, b) => a.createdAt - b.createdAt);
  const memberOf = it ? it.lists : [];
  const nextBlock = e.next && e.status !== 'terminado' ? `<div class="next-line">${cdPill(e.next.airingAt, `Ep ${e.next.episode} ·`)}<span class="card-sub">${esc(cap(fmtFull.format(new Date(e.next.airingAt * 1000))))}</span></div>` : '';

  const main = tracked ? `
    <div><div class="lbl">Estado</div>
      <div class="segmented status full">${Object.entries(STATUS).map(([k, l]) => `<button class="${it.status === k ? 'active' : ''}" data-act="set-status" data-v="${k}" aria-pressed="${it.status === k}">${l}</button>`).join('')}</div></div>
    <div><div class="lbl">Episodios vistos</div>
      <div class="stepper">
        <button class="btn btn-icon" data-act="sheet-minus" aria-label="Restar episodio">−</button>
        <input type="number" inputmode="numeric" min="0" ${it.episodes ? `max="${it.episodes}"` : ''} value="${it.progress}" data-act="set-progress" aria-label="Episodio actual">
        <button class="btn btn-icon btn-primary" data-act="sheet-plus" aria-label="Sumar episodio">+</button>
        <span class="card-sub">de ${it.episodes || '?'}${availableEpisodes(it) != null && it.mediaStatus === 'RELEASING' ? ` · ${availableEpisodes(it)} ${availableEpisodes(it) === 1 ? 'emitido' : 'emitidos'}` : ''}</span>
      </div></div>`
    : `<div><div class="lbl">Agregar a mis listas como…</div>
      <div class="row-btns">${Object.entries(STATUS).map(([k, l]) => `<button class="btn ${k === 'viendo' ? 'btn-primary' : ''}" data-act="add-as" data-v="${k}">${l}</button>`).join('')}</div></div>`;
  const score = `<div><div class="lbl">Mi puntuación ${e.score ? `<b class="score-now">★ ${e.score}/10</b>` : ''}</div>${rateGrid(e.score)}${e.score ? '<button class="btn btn-ghost btn-sm clear-score" data-act="score" data-v="0">Quitar puntuación</button>' : ''}</div>`;

  const notesBody = `
    <form class="note-form" data-form="note-add">
      <textarea name="text" rows="2" maxlength="2000" placeholder="¿Qué te pareció? Ej. “me encantó la pelea”" aria-label="Nueva nota"></textarea>
      <div class="note-form-row"><label class="ep-field">Episodio <input name="ep" type="number" min="1" inputmode="numeric" placeholder="—" aria-label="Episodio (opcional)"></label>
      <span class="spacer"></span><button class="btn btn-sm btn-primary" type="submit">Guardar nota</button></div>
    </form>
    ${e.notes.length ? `<ul class="notes">${e.notes.slice().sort((a, b) => b.createdAt - a.createdAt).map(noteHTML).join('')}</ul>` : '<p class="hint">Aún no hay notas. Puedes anotar algo general o ligado a un episodio.</p>'}`;
  const tagsBody = `
    <div class="lbl">Según AniList</div>
    <div class="tags">${types.length ? types.map(typeChip).join('') : '<span class="hint">Sin clasificación</span>'}</div>
    <div class="lbl" style="margin-top:14px">Tus etiquetas</div>
    <div class="tags">${e.customTags.length ? e.customTags.map((t) => `<span class="tag custom">#${esc(t)}<button data-act="tag-del" data-v="${esc(t)}" aria-label="Quitar etiqueta ${esc(t)}">✕</button></span>`).join('') : '<span class="hint">Agrega etiquetas propias, por ejemplo “maratón” o “joya oculta”.</span>'}</div>
    <form class="inline-form" data-form="tag-add"><input name="tag" list="tagSuggestions" maxlength="24" placeholder="Nueva etiqueta" aria-label="Nueva etiqueta"><button class="btn btn-sm" type="submit">${ICON.plus} Agregar</button></form>
    <datalist id="tagSuggestions">${allCustomTags().map((t) => `<option value="${esc(t)}">`).join('')}</datalist>`;
  const listsBody = `
    ${lists.length ? `<div class="list-toggles">${lists.map((l) => { const on = memberOf.includes(l.id); return `<button class="list-toggle${on ? ' on' : ''}" style="--lc:${esc(l.color)}" data-act="toggle-list" data-v="${l.id}" aria-pressed="${on}"><span>${esc(l.emoji)}</span>${esc(l.name)}<i aria-hidden="true">${on ? '✓' : '+'}</i></button>`; }).join('')}</div>` : '<p class="hint">Crea listas como “Para ver con amigos” o “Mis joyas” y agrega cualquier anime a varias.</p>'}
    <button class="btn btn-sm" data-act="new-list-for">${ICON.plus} Nueva lista</button>`;
  const datesBody = tracked ? `
    <div class="date-grid">
      <label>Empecé<input type="date" data-act="set-date" data-v="startedAt" value="${toInputDate(it.startedAt)}"></label>
      <label>Terminé<input type="date" data-act="set-date" data-v="finishedAt" value="${toInputDate(it.finishedAt)}"></label>
    </div>
    ${it.finishedApprox ? '<p class="hint">* Fecha aproximada (migrada de la versión 1). Puedes corregirla.</p>' : ''}
    <div class="field"><div>Veces vista<small>${it.rewatches ? `Lo has vuelto a ver ${it.rewatches} ${it.rewatches === 1 ? 'vez' : 'veces'}` : 'Primera vez'}</small></div>
      ${it.status === 'terminado' ? '<button class="btn btn-sm" data-act="rewatch">🔁 Volver a ver</button>' : `<b>${(it.rewatches || 0) + 1}</b>`}</div>` : '';
  const pills = [
    e.format && `<span class="pill">${esc(FORMAT[e.format] || e.format)}</span>`,
    e.seasonYear && `<span class="pill">${esc(e.season ? SEASON[e.season] + ' ' : '')}${e.seasonYear}</span>`,
    `<span class="pill">${e.episodes ? `${e.episodes} episodios` : 'Episodios: ?'}</span>`,
    e.duration && `<span class="pill">${e.duration} min/ep</span>`,
    e.mediaStatus && `<span class="pill ${e.mediaStatus === 'RELEASING' ? 'live' : ''}">${esc(MEDIA_STATUS[e.mediaStatus] || e.mediaStatus)}</span>`,
    e.avg && `<span class="pill" style="color:var(--warn)">★ ${(e.avg / 10).toFixed(1)} en AniList</span>`,
  ].filter(Boolean).join('');
  const infoBody = `<div class="tags">${pills}</div><a class="btn btn-ghost btn-sm" style="margin-top:12px" href="${esc(e.siteUrl)}" target="_blank" rel="noopener">Ver en AniList ↗</a>`;

  sh.innerHTML = `
    <div class="sheet-hero" style="background-image:url('${esc(e.banner || e.cover)}')"></div>
    <span class="sheet-grab" aria-hidden="true"></span>
    <button class="btn btn-icon sheet-close" data-act="close-sheet" aria-label="Cerrar">✕</button>
    <div class="sheet-top">
      <div class="cover"><img src="${esc(e.cover)}" alt=""></div>
      <div class="ttl">
        <h2 id="sheetTitle">${esc(e.title)}</h2>
        ${e.titleEn && e.titleEn !== e.title ? `<p class="alt">${esc(e.titleEn)}</p>` : ''}
        <div class="tags">${types.slice(0, 4).map(typeChip).join('')}${e.customTags.slice(0, 3).map(customChip).join('')}</div>
      </div>
      ${heartBtn(id, 'lg')}
    </div>
    <div class="sheet-body">
      ${nextBlock}
      ${main}
      ${score}
      <div class="secs">
        ${sec('notas', '📝 Notas y comentarios', e.notes.length, notesBody)}
        ${sec('tags', '🏷️ Clasificación y etiquetas', e.customTags.length, tagsBody)}
        ${sec('listas', '📚 Mis listas', memberOf.length, listsBody)}
        ${tracked ? sec('fechas', '📅 Fechas y repeticiones', 0, datesBody) : ''}
        ${sec('info', 'ℹ️ Información', 0, infoBody)}
      </div>
      ${it ? `<div class="sheet-foot"><button class="btn btn-danger btn-sm" data-act="remove">${ICON.trash} Quitar de AniAgenda</button></div>` : ''}
    </div>`;
  sh.scrollTop = scroll;
}

/* ================= Diálogos ================= */
function openDialog(html, label) {
  const d = $('#dialog');
  d.innerHTML = html; d.setAttribute('aria-label', label || 'Diálogo');
  d.hidden = false; $('#dialogBackdrop').hidden = false;
  d.style.animation = 'none'; void d.offsetWidth; d.style.animation = '';
  setTimeout(() => { const f = d.querySelector('input[type=text], .autofocus, button'); f && f.focus({ preventScroll: true }); }, 40);
}
function closeDialog() { const d = $('#dialog'); if (!d || d.hidden) return; d.hidden = true; $('#dialogBackdrop').hidden = true; d.innerHTML = ''; }
function openRateDialog(id) {
  const e = entry(id); if (!e) return;
  ui.rateFor = Number(id);
  openDialog(`
    <div class="dlg-head"><img src="${esc(e.coverSmall)}" alt=""><div><h3>¿Qué tal estuvo?</h3><p>${esc(e.title)}</p></div></div>
    ${rateGrid(e.score, 'dlg-score')}
    <div class="dlg-foot"><span class="spacer"></span><button class="btn btn-ghost" data-act="close-dialog">Ahora no</button></div>`, 'Puntuar');
}
function openPickDialog() {
  const pool = entries().filter((e) => e.status === 'pendiente');
  if (!pool.length) {
    openDialog(`<div class="pick-empty">${emptyHTML('🎲', 'No tienes pendientes', 'Marca algunos animes como <b>Pendiente</b> y te sugeriremos uno al azar cuando no sepas qué ver.', '<div class="row-center"><a class="btn btn-primary" href="#/inicio" data-act="close-dialog">Explorar temporada</a><a class="btn" href="#/buscar" data-act="close-dialog">Buscar</a></div>')}</div>`, '¿Qué veo hoy?');
    return;
  }
  let options = pool.filter((e) => e.id !== ui.lastPick);
  if (!options.length) options = pool;
  const e = options[Math.floor(Math.random() * options.length)];
  ui.lastPick = e.id;
  openDialog(`
    <div class="pick">
      <p class="eyebrow">🎲 ¿Qué veo hoy?</p>
      <div class="pick-card">
        <img src="${esc(e.cover)}" alt="">
        <div><h3>${esc(e.title)}</h3><p class="card-sub">${esc(seasonText(e))}</p><div class="tags">${displayTypes(e.types).slice(0, 3).map(typeChip).join('')}</div>
        ${e.avg ? `<p class="card-sub">★ ${(e.avg / 10).toFixed(1)} en AniList</p>` : ''}</div>
      </div>
      <div class="dlg-foot wrap">
        ${pool.length > 1 ? `<button class="btn" data-act="pick">${ICON.dice} Otra opción</button>` : ''}
        <span class="spacer"></span>
        <button class="btn btn-ghost" data-act="open" data-id="${e.id}">Ver ficha</button>
        <button class="btn btn-primary" data-act="pick-start" data-id="${e.id}">▶ Empezar a verlo</button>
      </div>
    </div>`, '¿Qué veo hoy?');
}
function openListDialog(listId = '', animeId = '') {
  const l = listId ? state.lists[listId] : null;
  const emoji = l ? l.emoji : LIST_EMOJIS[0];
  const color = l ? l.color : LIST_COLORS[Object.keys(state.lists).length % LIST_COLORS.length];
  openDialog(`
    <form data-form="list-save" data-v="${listId}" data-anime="${animeId}">
      <h3>${l ? 'Editar lista' : 'Nueva lista'}</h3>
      <label class="text-field">Nombre<input type="text" name="name" maxlength="40" required value="${l ? esc(l.name) : ''}" placeholder="Ej. Para ver con amigos"></label>
      <div class="lbl">Ícono</div>
      <div class="emoji-grid">${LIST_EMOJIS.map((em) => `<label><input type="radio" name="emoji" value="${em}" ${em === emoji ? 'checked' : ''}><span>${em}</span></label>`).join('')}</div>
      <div class="lbl">Color</div>
      <div class="color-grid">${LIST_COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''} aria-label="Color ${c}"><span style="background:${c}"></span></label>`).join('')}</div>
      <div class="dlg-foot wrap">
        ${l ? `<button type="button" class="btn btn-danger" data-act="list-del" data-v="${l.id}">${ICON.trash} Eliminar</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-act="close-dialog">Cancelar</button>
        <button type="submit" class="btn btn-primary">${l ? 'Guardar' : 'Crear lista'}</button>
      </div>
    </form>`, l ? 'Editar lista' : 'Nueva lista');
}

/* ================= Eventos ================= */
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-act]');
  if (!t || t.tagName === 'SELECT' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
  const act = t.dataset.act;
  const id = Number(t.dataset.id || ui.sheetId);
  switch (act) {
    case 'open': closeDialog(); openSheet(id); break;
    case 'close-sheet': closeSheet(); break;
    case 'close-dialog': closeDialog(); break;
    case 'add': addAnime(id); break;
    case 'add-season': addAnime(id, 'viendo', { season: true }); break;
    case 'add-as': addAnime(id, t.dataset.v); break;
    case 'remove': removeEntry(id); break;
    case 'fav': ev.stopPropagation(); toggleFavorite(id); break;
    case 'plus': {
      setProgress(id, (state.anime[id]?.progress || 0) + 1, true);
      const b = document.querySelector(`.card[data-id="${id}"] [data-act="plus"]`); if (b) b.classList.add('bump');
      break;
    }
    case 'minus': setProgress(id, (state.anime[id]?.progress || 0) - 1); break;
    case 'sheet-plus': setProgress(id, (state.anime[id]?.progress || 0) + 1, true); break;
    case 'sheet-minus': setProgress(id, (state.anime[id]?.progress || 0) - 1); break;
    case 'set-status': setStatus(id, t.dataset.v); break;
    case 'rate': openRateDialog(id); break;
    case 'score': setScore(id, Number(t.dataset.v)); if (Number(t.dataset.v)) toast(`★ ${t.dataset.v}/10 guardado`); break;
    case 'dlg-score': setScore(ui.rateFor, Number(t.dataset.v)); closeDialog(); toast(`★ ${t.dataset.v}/10 · ¡Gracias por puntuar!`); break;
    case 'type': {
      const ctx = t.dataset.ctx; ui.typeFilter[ctx] = t.dataset.v || null;
      if (ctx === 'home') renderSeasonResults(); else if (ctx === 'search') renderResults(); else renderListResults();
      break;
    }
    case 'list-tab': ui.listTab = t.dataset.v; ui.typeFilter.lists = null; ui.sort = 'smart'; ui.listQuery = ''; render(); break;
    case 'new-list': openListDialog(); break;
    case 'new-list-for': openListDialog('', ui.sheetId); break;
    case 'edit-list': openListDialog(t.dataset.v); break;
    case 'list-del': closeDialog(); deleteList(t.dataset.v); break;
    case 'toggle-list': toggleInList(ui.sheetId, t.dataset.v); break;
    case 'note-edit': ui.editingNote = t.dataset.v; renderSheet(); { const ta = $('#sheet form[data-form="note-edit"] textarea'); ta && ta.focus(); } break;
    case 'note-cancel': ui.editingNote = null; renderSheet(); break;
    case 'note-del': deleteNote(ui.sheetId, t.dataset.v); break;
    case 'tag-del': removeCustomTag(ui.sheetId, t.dataset.v); break;
    case 'rewatch': rewatch(ui.sheetId); break;
    case 'pick': openPickDialog(); break;
    case 'pick-start': closeDialog(); setStatus(id, 'viendo'); toast(`▶ ¡A ver <b>${esc(state.anime[id].title)}</b>!`, { img: state.anime[id].coverSmall }); break;
    case 'profile-tab': ui.profileTab = t.dataset.v; render(); break;
    case 'clear-search': { const i = $('#searchInput'); i.value = ''; t.hidden = true; doSearch(''); i.focus(); break; }
    case 'retry-search': doSearch(ui.search.q); break;
    case 'retry-trending': ui.trendingError = null; renderResults(); loadTrending(); break;
    case 'retry-season': ui.seasonError = null; renderSeasonResults(); loadSeason(); break;
    case 'cal-mode': ui.calMode = t.dataset.v; ui.weekError = null; ui.daySetByUser = false; ui.selectedDay = null; render(); break;
    case 'week': {
      const v = Number(t.dataset.v);
      ui.weekOffset = v === 0 ? 0 : ui.weekOffset + v;
      ui.selectedDay = ui.weekOffset === 0 ? dayIdx(new Date()) : 0;
      ui.daySetByUser = ui.weekOffset !== 0; ui.weekError = null; render(); break;
    }
    case 'day':
      ui.selectedDay = Number(t.dataset.v); ui.daySetByUser = true;
      document.querySelectorAll('.day-tab').forEach((el, i) => el.classList.toggle('active', i === ui.selectedDay));
      document.querySelectorAll('.day-col').forEach((el, i) => el.classList.toggle('active', i === ui.selectedDay));
      break;
    case 'retry-week': ui.weekError = null; render(); break;
    case 'dismiss-banner': state.settings.bannerDismissed = dateKey(new Date()); save(); renderBanner(); break;
    case 'ask-perm': askPermission(); break;
    case 'test-notif':
      showNotification('AniAgenda', '¡Así se verán tus alertas de nuevos episodios! 📺', { tag: 'test' }).then((ok) => toast(ok ? 'Notificación de prueba enviada' : 'No se pudo mostrar la notificación'));
      break;
    case 'install': if (ui.installEvt) { ui.installEvt.prompt(); ui.installEvt.userChoice.finally(() => { ui.installEvt = null; render(); }); } break;
    case 'export': exportData(); break;
    default: break;
  }
});

document.addEventListener('submit', (ev) => {
  const f = ev.target; const kind = f.dataset.form; if (!kind) return;
  ev.preventDefault();
  const fd = new FormData(f);
  if (kind === 'note-add') {
    if (addNote(ui.sheetId, fd.get('text'), fd.get('ep'))) { ui.openSecs.add('notas'); renderSheet(); refreshCard(ui.sheetId); toast('📝 Nota guardada'); }
  } else if (kind === 'note-edit') {
    updateNote(ui.sheetId, f.dataset.v, fd.get('text'), fd.get('ep')); ui.editingNote = null; renderSheet(); toast('Nota actualizada');
  } else if (kind === 'tag-add') {
    ui.openSecs.add('tags'); addCustomTag(ui.sheetId, fd.get('tag'));
  } else if (kind === 'list-save') {
    const name = String(fd.get('name') || '').trim(); if (!name) return;
    const listId = f.dataset.v; const animeId = Number(f.dataset.anime);
    if (listId) { updateList(listId, name, fd.get('emoji'), fd.get('color')); toast('Lista actualizada'); }
    else {
      const nid = createList(name, fd.get('emoji'), fd.get('color'));
      if (animeId) { ui.openSecs.add('listas'); closeDialog(); toggleInList(animeId, nid); }
      else { ui.listTab = `list:${nid}`; toast(`Lista ${esc(fd.get('emoji'))} <b>${esc(name)}</b> creada`); }
    }
    closeDialog(); render(); if (ui.sheetId) renderSheet();
  }
});
document.addEventListener('change', (ev) => {
  const t = ev.target; const act = t.dataset && t.dataset.act; if (!act) return;
  if (act === 'sort') { ui.sort = t.value; renderListResults(); }
  else if (act === 'set-progress') setProgress(ui.sheetId, t.value);
  else if (act === 'set-date') { const e = entry(ui.sheetId); if (e) { e[t.dataset.v] = fromInputDate(t.value); if (t.dataset.v === 'finishedAt') e.finishedApprox = false; save(); refreshCard(e.id); } }
  else if (act === 'lead') { state.settings.lead = Number(t.value); save(); }
  else if (act === 'toggle-notify') {
    if (t.checked && 'Notification' in window && Notification.permission !== 'granted') { t.checked = false; askPermission(); return; }
    state.settings.notify = t.checked; save(); render(); if (t.checked) checkAlerts();
  } else if (act === 'toggle-pending') { state.settings.includePending = t.checked; save(); render(); }
  else if (act === 'import') importData(t.files && t.files[0]);
});
document.addEventListener('toggle', (ev) => {
  const d = ev.target; if (!d.matches || !d.matches('details.sec')) return;
  if (d.open) ui.openSecs.add(d.dataset.sec); else ui.openSecs.delete(d.dataset.sec);
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('#dialog').hidden) closeDialog(); else closeSheet(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('label.btn[tabindex]')) { e.preventDefault(); e.target.querySelector('input').click(); }
});
$('#sheetBackdrop').addEventListener('click', closeSheet);
$('#dialogBackdrop').addEventListener('click', closeDialog);

function exportData() {
  const data = { app: 'AniAgenda', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), anime: state.anime, lists: state.lists, settings: state.settings };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `aniagenda-respaldo-${dateKey(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Respaldo descargado');
}
function importData(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const raw = JSON.parse(r.result);
      if (!raw || (typeof raw.list !== 'object' && typeof raw.anime !== 'object')) throw new Error('formato');
      const inc = upgrade(raw); // acepta respaldos v1 y v2
      Object.values(inc.anime).forEach((n) => {
        const cur = state.anime[n.id];
        if (!cur) { state.anime[n.id] = n; return; }
        // fusiona sin perder notas, listas, etiquetas ni favoritos que ya tenías
        const notes = [...cur.notes]; n.notes.forEach((x) => { if (!notes.some((y) => y.id === x.id)) notes.push(x); });
        state.anime[n.id] = normalizeEntry({ ...cur, ...n, notes, lists: [...new Set([...cur.lists, ...n.lists])],
          customTags: [...new Set([...cur.customTags, ...n.customTags])], favorite: cur.favorite || n.favorite, score: n.score || cur.score });
      });
      state.lists = { ...state.lists, ...inc.lists };
      save(); afterChange(true); refreshListInfo(true);
      toast(`Importados ${Object.keys(inc.anime).length} animes${Object.keys(inc.lists).length ? ` y ${Object.keys(inc.lists).length} listas` : ''}`);
    } catch (e) { toast('Archivo no válido'); }
  };
  r.readAsText(file);
}

/* ================= Arranque ================= */
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installEvt = e; if (ui.route === 'perfil') render(); });
window.addEventListener('appinstalled', () => { ui.installEvt = null; toast('¡AniAgenda instalada! 🎉'); });
window.addEventListener('hashchange', onRoute);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tick(); refreshListInfo(); refreshSchedule(); } });

function tick() {
  updateCountdowns();
  checkAlerts();
  const dk = dateKey(new Date());
  if (tick.lastDay && tick.lastDay !== dk) { renderBanner(); if (ui.route === 'calendario') { ui.selectedDay = null; render(); } }
  tick.lastDay = dk;
}
function init() {
  $('#tzLabel').textContent = `Zona: ${TZ.replace(/_/g, ' ')}`;
  onRoute();
  if (justMigrated) setTimeout(() => toast(`✓ Actualizamos tus datos a AniAgenda 2 (${Object.keys(state.anime).length} animes)`), 400);
  refreshListInfo(justMigrated).then(() => refreshSchedule());
  setInterval(tick, 30 * 1000); // cuenta regresiva y alertas cada 30 s
  setInterval(() => { refreshSchedule(); refreshListInfo(); }, 15 * 60 * 1000);
  tick();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => console.warn('SW no registrado', e));
  }
}
init();

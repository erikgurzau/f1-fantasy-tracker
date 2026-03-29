// ── SHARED STATE ─────────────────────────────────────────
let REG          = null;
let RESULTS      = {};
let STATE        = {};
let activeKey    = null;
let selectedRound = null;
let cdInterval   = null;
let currentRound = null;
let nextRound    = null;

function league() { return STATE[activeKey]; }

// ── SESSION CONSTANTS ─────────────────────────────────────
const SESSION_DURATION = {
    fp1:  60 * 60 * 1000,
    fp2:  60 * 60 * 1000,
    fp3:  60 * 60 * 1000,
    sq:   45 * 60 * 1000,
    sr:   75 * 60 * 1000,
    q:    60 * 60 * 1000,
    r:   120 * 60 * 1000,
};
const SESSION_ORDER_STD = ['fp1', 'fp2', 'fp3', 'q', 'r'];
const SESSION_ORDER_SPR = ['fp1', 'sq', 'sr', 'q', 'r'];
const SESSION_LABELS = {
    fp1: 'FP1', fp2: 'FP2', fp3: 'FP3',
    sq: 'SPRINT_QUALIFY', sr: 'SPRINT_RACE',
    q: 'QUALIFY', r: 'RACE',
};

function sessionOrder(fmt) {
    return fmt === 'spr' ? SESSION_ORDER_SPR : SESSION_ORDER_STD;
}

// ── ROUND STATUS ──────────────────────────────────────────
function isRoundComplete(r) {
    const rd = RESULTS[r.id];
    return rd && rd.updated_to === 'r';
}

function isRoundPartial(r) {
    const rd = RESULTS[r.id];
    return rd && rd.updated_to && rd.updated_to !== 'r';
}

function getRoundStatus(r) {
    if (r.status === 'cancelled') return 'cancelled';
    if (isRoundComplete(r))      return 'completed';
    if (isRoundPartial(r))       return 'current';
    if (currentRound && r.id === currentRound.id) return 'current';
    if (nextRound && r.id === nextRound.id) return 'next';
    return 'upcoming';
}

function deriveCurrentRound() {
    for (const r of REG.rounds) {
        if (isRoundPartial(r)) return r;
    }
    const completedIds = new Set(REG.rounds.filter(r => isRoundComplete(r)).map(r => r.id));
    let lastIdx = -1;
    REG.rounds.forEach((r, i) => { if (completedIds.has(r.id)) lastIdx = i; });
    for (let i = lastIdx + 1; i < REG.rounds.length; i++) {
        if (REG.rounds[i].status !== 'cancelled') return REG.rounds[i];
    }
    if (lastIdx >= 0) return REG.rounds[lastIdx];
    return REG.rounds.find(r => r.status !== 'cancelled') ?? null;
}

function deriveNextRound(current = currentRound) {
    if (!current) return null;
    const idx = REG.rounds.findIndex(r => r.id === current.id);
    for (let i = idx + 1; i < REG.rounds.length; i++) {
        if (REG.rounds[i].status !== 'cancelled') return REG.rounds[i];
    }
    return null;
}

function lastCompletedRound() {
    let last = null;
    for (const r of REG.rounds) { if (isRoundComplete(r)) last = r; }
    return last;
}

function nextSession(round) {
    if (!round.sessions) return null;
    const order = sessionOrder(round.fmt);
    const now   = Date.now();
    let liveSession = null;
    for (const key of order) {
        const iso = round.sessions[key]; if (!iso) continue;
        const start = new Date(iso).getTime();
        const dur   = SESSION_DURATION[key] ?? 120 * 60 * 1000;
        if (start > now) {
            return { key, label: SESSION_LABELS[key] ?? key.toUpperCase(), iso, ms: start - now, live: false };
        }
        if (now < start + dur) {
            liveSession = { key, label: SESSION_LABELS[key] ?? key.toUpperCase(), iso, ms: 0, live: true };
        }
    }
    return liveSession;
}

// ── PURE HELPERS ──────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }

function formatCD(ms) {
    if (ms <= 0) return { d: '00', h: '00', m: '00', s: '00' };
    const t = Math.floor(ms / 1000);
    return {
        d: pad(Math.floor(t / 86400)),
        h: pad(Math.floor((t % 86400) / 3600)),
        m: pad(Math.floor((t % 3600) / 60)),
        s: pad(t % 60),
    };
}

function accClass(v)  { return v >= 80 ? 'pos' : v >= 60 ? 'warn' : 'neg'; }
function ptsClass(v)  { return v < 0 ? 'neg' : ''; }

function diffHtml(diff, small) {
    const cls = small ? 'diff-small' : '';
    if (diff === 0) return `<span class="muted ${cls}">=</span>`;
    return diff > 0
        ? `<span class="pos ${cls}">+${diff.toFixed(1)}</span>`
        : `<span class="neg ${cls}">${diff.toFixed(1)}</span>`;
}

function shortName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.length < 2 ? fullName : parts[0][0] + '. ' + parts.slice(1).join(' ');
}

function sessionDateLabel(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase()
        + ', '
        + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function flagImg(cc, name, cls = '') {
    return `<img src="https://flagcdn.com/w40/${cc ?? 'un'}.png" alt="${name}"${cls ? ` class="${cls}"` : ''}>`;
}

function sprintBadge(fmt, size = '') {
    if (fmt !== 'spr') return '';
    return `<span class="sprint-badge${size ? ' sprint-badge--' + size : ''}">SPRINT</span>`;
}

function roundLabel(round, statusOverride) {
    const status = statusOverride ?? getRoundStatus(round);
    const colorClass = status === 'completed' ? 'pos' : status === 'current' ? 'accent' : status === 'cancelled' ? 'neg' : status === 'next' ? 'text-main' : '';
    const labelMap   = { completed: 'COMPLETED', current: 'CURRENT', cancelled: 'CANCELLED', upcoming: 'UPCOMING', next: 'NEXT' };
    const text       = labelMap[status] ?? status.toUpperCase();
    return `R${pad(round.n)} — <span class="${colorClass}">${text}</span>`;
}
// ── DATA ─────────────────────────────────────────────────
// REG loaded async from registry.json
// RESULTS loaded async from points.json
let REG     = null;
let RESULTS = {};

async function loadData() {
    [REG, RESULTS] = await Promise.all([
        fetch('./data/registry.json').then(r => r.json()),
        fetch('./data/points.json').then(r => r.json()).catch(() => ({}))
    ]);
}

// ── SESSION HELPERS ───────────────────────────────────────

// Session durations in ms (approximate, for LIVE detection)
const SESSION_DURATION = {
    fp1: 60*60*1000, fp2: 60*60*1000, fp3: 60*60*1000,
    sprint_qualy: 45*60*1000, sprint: 75*60*1000,
    qualy: 60*60*1000, race: 120*60*1000
};
const SESSION_ORDER_STD = ["fp1","fp2","fp3","qualy","race"];
const SESSION_ORDER_SPR = ["fp1","sprint_qualy","sprint","qualy","race"];

const SESSION_LABELS = {
    fp1:"FP1", fp2:"FP2", fp3:"FP3",
    sprint_qualy:"SPRINT_Q", sprint:"SPRINT", qualy:"QUALIFYING", race:"RACE"
};

function sessionOrder(fmt) {
    return fmt === "spr" ? SESSION_ORDER_SPR : SESSION_ORDER_STD;
}

// ── ROUND STATUS ──────────────────────────────────────────
function isRoundComplete(r) {
    const rd = RESULTS[r.id];
    return rd && rd.updated_to === "race";
}

function isRoundPartial(r) {
    const rd = RESULTS[r.id];
    return rd && rd.updated_to && rd.updated_to !== "race";
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

function deriveNextRound(current) {
    if (!current) return null;
    const currentIndex = REG.rounds.findIndex(r => r.id === current.id);
    for (let i = currentIndex + 1; i < REG.rounds.length; i++) {
        if (REG.rounds[i].status !== 'cancelled') return REG.rounds[i];
    }
    return null;
}

// ── PRICE / PRECOMPUTE ────────────────────────────────────
function latestPrice(code, type) {
    let price = null;
    for (const r of REG.rounds) {
        const rd = RESULTS[r.id]; if (!rd) continue;
        const entry = rd[type]?.[code];
        if (entry?.price != null) price = entry.price;
    }
    return price;
}

let STATE = {};

function precompute() {
    REG.championships.forEach(league => {
        const players = league.players.map(p => {
            const rounds = {};
            let totalPts = 0, totalExp = 0;

            REG.rounds.forEach(r => {
                const rd = RESULTS[r.id]; if (!rd) return;
                let rPts = 0, rExp = 0;
                const dBrk = {}, cBrk = {};
                [p.team.captain, ...p.team.drivers].forEach(d => {
                    const isCap = d === p.team.captain;
                    const base  = rd.drivers[d]; if (!base) return;
                    const pts = isCap ? base.pts * 2 : base.pts;
                    const exp = isCap ? base.exp * 2 : base.exp;
                    dBrk[d] = { pts: base.pts, exp: base.exp, isCap };
                    rPts += pts; rExp += exp;
                });
                p.team.constructors.forEach(c => {
                    const base = rd.constructors[c]; if (!base) return;
                    cBrk[c] = { pts: base.pts, exp: base.exp };
                    rPts += base.pts; rExp += base.exp;
                });
                const acc = rExp !== 0 ? Math.max(0, 100 - Math.abs(rPts - rExp) / Math.abs(rExp) * 100) : 0;
                rounds[r.id] = { pts: rPts, exp: rExp, acc, drivers: dBrk, constructors: cBrk };
                totalPts += rPts; totalExp += rExp;
            });

            const totalAcc = totalExp !== 0 ? Math.max(0, 100 - Math.abs(totalPts - totalExp) / Math.abs(totalExp) * 100) : 0;
            const allDrivers = [p.team.captain, ...p.team.drivers];
            const budgetInit = allDrivers.reduce((s, d) => s + (REG.drivers[d]?.init_price ?? 0), 0)
                             + p.team.constructors.reduce((s, c) => s + (REG.constructors[c]?.init_price ?? 0), 0);
            const budgetCurr = allDrivers.reduce((s, d) => s + (latestPrice(d, 'drivers') ?? REG.drivers[d]?.init_price ?? 0), 0)
                             + p.team.constructors.reduce((s, c) => s + (latestPrice(c, 'constructors') ?? REG.constructors[c]?.init_price ?? 0), 0);

            return { ...p, rounds, totalPts, totalExp, totalAcc, budgetInit, budgetCurr };
        });

        const sorted = [...players].sort((a, b) => b.totalPts - a.totalPts);
        const leaderPts = sorted[0]?.totalPts ?? 0;
        sorted.forEach((p, i) => { p.rank = i + 1; p.gap = p.totalPts - leaderPts; });
        sorted.forEach(p => { p.wins = 0; });
        REG.rounds.filter(r => isRoundComplete(r)).forEach(r => {
            let best = -Infinity, winners = [];
            players.forEach(p => {
                const rp = p.rounds[r.id]?.pts ?? -Infinity;
                if (rp > best) { best = rp; winners = [p.code]; }
                else if (rp === best) winners.push(p.code);
            });
            winners.forEach(code => { const p = sorted.find(x => x.code === code); if (p) p.wins++; });
        });

        STATE[league.key] = { players: sorted };
    });
}

// ── HELPERS ───────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function formatCD(ms) {
    if (ms <= 0) return { d:'00', h:'00', m:'00', s:'00' };
    const t = Math.floor(ms / 1000);
    return { d:pad(Math.floor(t/86400)), h:pad(Math.floor((t%86400)/3600)), m:pad(Math.floor((t%3600)/60)), s:pad(t%60) };
}
function accClass(v)  { return v >= 80 ? 'pos' : v >= 60 ? 'warn' : 'neg'; }
function ptsClass(v)  { return v < 0 ? 'neg' : ''; }
function diffHtml(diff, small) {
    const fs = small ? 'font-size:.68rem' : '';
    if (diff === 0) return `<span class="muted" style="${fs}">=</span>`;
    return diff > 0
        ? `<span class="pos" style="${fs}">+${diff.toFixed(1)}</span>`
        : `<span class="neg" style="${fs}">${diff.toFixed(1)}</span>`;
}
function shortName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.length < 2 ? fullName : parts[0][0] + '. ' + parts.slice(1).join(' ');
}
function nextSession(round) {
    if (!round.sessions) return null;
    const order = sessionOrder(round.fmt);
    const now = Date.now();
    let liveSession = null;
    for (const key of order) {
        const iso = round.sessions[key]; if (!iso) continue;
        const start = new Date(iso).getTime();
        const dur   = SESSION_DURATION[key] ?? 120 * 60 * 1000;
        if (start > now) {
            // future session — return it (takes priority over live)
            return { key, label: SESSION_LABELS[key] ?? key.toUpperCase(), iso, ms: start - now, live: false };
        }
        if (now < start + dur) {
            // currently ongoing — remember it, keep scanning for future ones
            liveSession = { key, label: SESSION_LABELS[key] ?? key.toUpperCase(), iso, ms: 0, live: true };
        }
    }
    return liveSession; // null if all sessions are fully past
}
function lastCompletedRound() {
    let last = null;
    for (const r of REG.rounds) { if (isRoundComplete(r)) last = r; }
    return last;
}

// ── STATE ─────────────────────────────────────────────────
let activeKey     = null;
let selectedRound = null;
let cdInterval    = null;
let currentRound  = null;
function league() { return STATE[activeKey]; }

// ── CLOCK + UPDATED ───────────────────────────────────────
function startClock() {
    function tick() {
        const now = new Date();
        const d = now.toLocaleDateString('it-IT', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
        const t = now.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        const el = document.getElementById('live-clock');
        if (el) el.textContent = d.toUpperCase() + ' // ' + t;
        renderUpdatedStatus(now);
    }
    tick();
    setInterval(tick, 1000);
}

function renderUpdatedStatus(now) {
    const el = document.getElementById('updated-status');
    if (!el) return;

    // Use last completed round if currentRound has no sessions started yet
    const checkRound = (() => {
        if (!currentRound) return null;
        const sess  = currentRound.sessions ?? {};
        const order = sessionOrder(currentRound.fmt);
        const anyStarted = order.some(k => sess[k] && new Date(sess[k]) < now);
        if (anyStarted) return currentRound;
        // currentRound hasn't started — check last completed instead
        return lastCompletedRound() ?? currentRound;
    })();

    if (!checkRound) {
        el.innerHTML = `UPDATED: <span style="color:var(--text-muted);font-weight:700">—</span>`;
        return;
    }

    const rd    = RESULTS[checkRound.id];
    const order = sessionOrder(checkRound.fmt);
    const sess  = checkRound.sessions ?? {};

    let lastStarted = null;
    for (const key of order) {
        if (sess[key] && new Date(sess[key]) < now) lastStarted = key;
    }

    if (!lastStarted) {
        el.innerHTML = `UPDATED: <span style="color:var(--text-muted);font-weight:700">—</span>`;
        return;
    }

    const updatedTo      = rd?.updated_to?.toLowerCase() ?? null;
    const updatedToIdx   = updatedTo ? order.indexOf(updatedTo) : -1;
    const lastStartedIdx = order.indexOf(lastStarted);

    if (updatedToIdx >= lastStartedIdx && updatedToIdx !== -1) {
        el.innerHTML = `UPDATED: <span style="color:var(--pos);font-weight:700">TRUE</span> <span style="color:var(--text-muted);font-size:.7rem">(${SESSION_LABELS[lastStarted] ?? lastStarted.toUpperCase()})</span>`;
    } else {
        el.innerHTML = `UPDATED: <span style="color:var(--neg);font-weight:700">FALSE</span> <span style="color:var(--text-muted);font-size:.7rem">(${SESSION_LABELS[lastStarted] ?? lastStarted.toUpperCase()})</span>`;
    }
}

// ── BANNER ────────────────────────────────────────────────
function renderBanner() {
    const completed = REG.rounds.filter(r => isRoundComplete(r)).length;
    const inProgress = REG.rounds.filter(r => isRoundPartial(r)).length;
    const total     = REG.rounds.length; // all 24 rounds
    const current   = currentRound ? currentRound.n : completed + inProgress;
    const pct       = Math.round(current / total * 100);
    const last      = lastCompletedRound();
    const next      = currentRound;

    if (cdInterval) clearInterval(cdInterval);

    const lastCc = last ? (last.cc ?? 'un') : '';
    const lastBlock = `
        <div class="px-3 pb-3">
            <div class="label" style="margin-bottom:.3rem">LAST_ROUND</div>
            <div class="rc-flag fw-bold" style="display:flex;align-items:center;gap:.6rem;">
                ${last ? `<img src="https://flagcdn.com/w40/${lastCc}.png" alt="${last.name}">` : ''}
                ${last ? last.name.toUpperCase() : 'N/A'}
            </div>
            ${last ? `<div style="font-size:.78rem;color:var(--pos);margin-top:3px"><i class="bi bi-check-circle me-1"></i>ROUND_${pad(last.n)}_COMPLETED</div>` : ''}
        </div>`;

    let nextBlock = '';
    if (next) {
        const sess = nextSession(next);
        if (sess) {
            const cd = formatCD(sess.ms);
            const now0 = new Date();
            const elapsed0 = now0 - new Date(sess.iso);
            const dur0 = SESSION_DURATION[sess.key] ?? 120*60*1000;
            const isLiveNow = sess.live === true || (sess.ms <= 0 && elapsed0 < dur0);
            const cdContent = isLiveNow
                ? `<div class="live-badge"><span class="live-dot"></span>LIVE</div>`
                : `<div class="cd-block"><div class="cd-digits" id="cd-d">${cd.d}</div><div class="cd-unit">DAYS</div></div>
                    <div class="cd-sep">:</div>
                    <div class="cd-block"><div class="cd-digits" id="cd-h">${cd.h}</div><div class="cd-unit">HRS</div></div>
                    <div class="cd-sep">:</div>
                    <div class="cd-block"><div class="cd-digits" id="cd-m">${cd.m}</div><div class="cd-unit">MIN</div></div>
                    <div class="cd-sep">:</div>
                    <div class="cd-block"><div class="cd-digits" id="cd-s">${cd.s}</div><div class="cd-unit">SEC</div></div>`;
            nextBlock = `
            <div class="banner-sep"></div>
            <div class="banner-left p-3">
                <div class="banner-next-label">CURRENT_ROUND</div>
                <div class="rc-flag" style="display:flex;align-items:center;gap:.6rem;margin-bottom:.35rem">
                    <img src="https://flagcdn.com/w40/${next.cc ?? 'un'}.png" alt="${next.name}">
                    ${next.name.toUpperCase()}
                </div>
                <div class="banner-sess-label">
                    <i class="bi bi-clock me-1 align-middle"></i><span style="color:var(--text-main);margin-left:.2rem">${sess.label}</span>
                    <span style="color:var(--text-muted);font-size:.75rem">— ${new Date(sess.iso).toLocaleDateString('it-IT',{day:'2-digit',month:'short'}).toUpperCase()}, ${new Date(sess.iso).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
                <div class="cd-wrap" id="cd-wrap-live">
                    ${cdContent}
                </div>
            </div>`;
            cdInterval = setInterval(() => {
                const now2 = new Date();
                const rem  = new Date(sess.iso) - now2;
                const elapsed = now2 - new Date(sess.iso); // negative if not started
                const dur = SESSION_DURATION[sess.key] ?? 120*60*1000;
                const cdWrap = document.getElementById('cd-wrap-live');
                if (!cdWrap) return;
                if (rem > 0) {
                    // still counting down
                    const t = formatCD(rem);
                    ['d','h','m','s'].forEach(k => { const el = document.getElementById('cd-' + k); if (el) el.textContent = t[k]; });
                } else if (elapsed < dur) {
                    // session is LIVE
                    cdWrap.innerHTML = `<div class="live-badge"><span class="live-dot"></span>LIVE</div>`;
                    clearInterval(cdInterval);
                } else {
                    // session ended, re-render banner
                    clearInterval(cdInterval);
                    renderBanner();
                }
            }, 1000);
        }
    }

    document.getElementById('banner').innerHTML = `
        <div class="px-3 pt-3">
            <div class="label" style="margin-bottom:.5rem">SEASON_PROGRESS &nbsp;&mdash;&nbsp; R${pad(current)} / R${pad(total)}</div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        </div>
        ${lastBlock}${nextBlock}`;
}

// ── STANDINGS ─────────────────────────────────────────────
function renderStandings() {
    const players = league().players;
    const wrap    = document.getElementById('standings-wrap');

    let html = `<div class="standings-header">
        <div class="label" style="text-align:center">#</div>
        <div class="label">PLAYER</div>
        <div class="label" style="text-align:right">PTS</div>
        <div class="label" style="text-align:right">W</div>
        <div class="label" style="text-align:right">GAP</div>
    </div>`;

    players.forEach((p, i) => {
        const isLeader = i === 0;
        const gapHtml  = isLeader
            ? `<span class="pos" style="font-size:.78rem">LEADER</span>`
            : `<span class="neg">${p.gap}</span>`;

        const allDrivers = [p.team.captain, ...p.team.drivers];

        const makeRow = (code, name, con, isCap, type) => {
            const initP = type === 'drivers'
                ? (REG.drivers[code]?.init_price ?? 0)
                : (REG.constructors[code]?.init_price ?? 0);
            const currP = latestPrice(code, type) ?? initP;
            const diff  = currP - initP;
            return `<div class="hub-row price-row">
                <div class="driver-tag" style="border-color:var(--${con})">${code}${isCap ? '<span class="x2">X2</span>' : ''}</div>
                <div>${initP.toFixed(1)}M</div>
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:.35rem">
                    <span style="font-size:.7rem">${diffHtml(diff, true)}</span>
                    <span>${currP.toFixed(1)}M</span>
                </div>
            </div>`;
        };

        const dRows = allDrivers.map(d => {
            const dr = REG.drivers[d]; if (!dr) return '';
            return makeRow(d, dr.name, dr.constructor.toLowerCase(), d === p.team.captain, 'drivers');
        }).join('');

        const cRows = p.team.constructors.map(c => {
            const cr = REG.constructors[c]; if (!cr) return '';
            return makeRow(c, cr.name, c.toLowerCase(), false, 'constructors');
        }).join('');

        const budgetDiff = p.budgetCurr - p.budgetInit;
        const totalBlock = `
            <div class="detail-total">
                <div class="detail-total-col" style="text-align:left">
                    <div class="detail-total-label">INIT_VALUE</div>
                    <div class="detail-total-val">${p.budgetInit.toFixed(1)}M</div>
                </div>
                <div class="detail-total-col">
                    <div class="detail-total-label">CURR_VALUE</div>
                    <div class="detail-total-val" style="display:flex;align-items:baseline;justify-content:flex-end;gap:.4rem">
                        <span class="detail-total-diff">${diffHtml(budgetDiff, false)}</span>
                        <span>${p.budgetCurr.toFixed(1)}M</span>
                    </div>
                </div>
            </div>`;

        html += `<div class="standings-row${isLeader ? ' leader-row' : ''}">
            <div class="standings-main" onclick="toggleDetail('sd-${p.code}',this)">
                <div class="s-rank">${p.rank}</div>
                <div class="s-name">${p.code}<span style="font-size:.7rem;font-weight:400;color:var(--text-muted);margin-left:6px">${p.name}</span><i class="bi bi-chevron-down s-chevron"></i></div>
                <div class="s-pts" style="color:${isLeader ? 'var(--warn)' : 'var(--text-main)'}">${p.totalPts}</div>
                <div class="s-wins">${p.wins}</div>
                <div class="s-gap">${gapHtml}</div>
            </div>
            <div class="standings-detail" id="sd-${p.code}">
                <div class="hub-row price-row hub-row-hd"><div>DRIVER</div><div>INIT_VALUE</div><div>CURR_VALUE</div></div>
                ${dRows}
                <div class="hub-row price-row hub-row-hd" style="margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--border)"><div>CONSTRUCTOR</div><div>INIT_VALUE</div><div>CURR_VALUE</div></div>
                ${cRows}
                ${totalBlock}
            </div>
        </div>`;
    });

    wrap.innerHTML = html;
}

function toggleDetail(id, rowEl) {
    const detail  = document.getElementById(id);
    const chevron = rowEl.querySelector('.s-chevron');
    const isOpen  = detail.classList.toggle('open');
    chevron?.classList.toggle('open', isOpen);
}

// ── CAROUSEL ──────────────────────────────────────────────
function renderCarousel() {
    const el      = document.getElementById('carousel');
    const dotMap  = { completed:'dot-completed', current:'dot-current', upcoming:'dot-upcoming', cancelled:'dot-cancelled' };
    const stLabel = { completed:'DONE', current:'CURRENT', upcoming:'UPCOMING', cancelled:'CANCELLED' };

    el.innerHTML = REG.rounds.map(r => {
        const status  = getRoundStatus(r);
        const isSel   = r.id === selectedRound;
        const cc      = r.cc ?? 'un';
        const classes = ['race-card',
            status === 'completed' ? 'is-done'     : '',
            status === 'current'   ? 'is-current'  : '',
            status === 'cancelled' ? 'is-cancelled': '',
            isSel                  ? 'active'      : ''
        ].filter(Boolean).join(' ');

        const sprintBadge = r.fmt === 'spr' ? `<span class="rc-spr-badge">SPRINT</span>` : '';

        const overlay = status === 'completed'
            ? `<div class="rc-overlay-done"></div>`
            : status === 'cancelled'
            ? `<div class="rc-overlay-cancelled"></div>`
            : '';
        return `<div class="${classes}" data-round-id="${r.id}" onclick="selectRace('${r.id}')">
            ${overlay}
            <div class="rc-round">
                <div class="rc-round-left">
                    <span class="dot ${dotMap[status] ?? dotMap.upcoming}"></span>
                    <span>R${pad(r.n)}</span>
                </div>
                ${sprintBadge}
            </div>
            <div class="rc-flag">
                <img src="https://flagcdn.com/w40/${cc}.png" alt="${r.name}" loading="lazy">
            </div>
            <div class="rc-name">${r.name}</div>
            <div class="rc-date">${r.date}</div>
            <div class="rc-status ${status}">${status}</div>
        </div>`;
    }).join('');

    setTimeout(() => {
        const active = el.querySelector('.active');
        if (active) {
            // scroll only within the carousel, never jump the page
            const container = el;
            const cardLeft  = active.offsetLeft;
            const center    = cardLeft - (container.clientWidth / 2) + (active.offsetWidth / 2);
            container.scrollLeft = Math.max(0, center);
        }
        setTimeout(syncScrubber, 100);
        setTimeout(updateCurrentBtn, 500);
    }, 60);

    if (!el._scrubListening) {
        el.addEventListener('scroll', () => { syncScrubber(); updateCurrentBtn(); }, { passive: true });
        el._scrubListening = true;
    }
}

function shiftCar(steps) {
    document.getElementById('carousel').scrollBy({ left: steps * 114, behavior:'smooth' });
    setTimeout(syncScrubber, 300);
}
function syncScrubber() {
    const c     = document.getElementById('carousel');
    const fill  = document.getElementById('scrubber-fill');
    const thumb = document.getElementById('scrubber-thumb');
    if (!c || !fill || !thumb) return;
    const max = c.scrollWidth - c.clientWidth;
    const pct = max > 0 ? (c.scrollLeft / max) * 100 : 0;
    fill.style.width = pct + '%';
    thumb.style.left = pct + '%';
}
function scrubberClick(e) {
    const s = document.getElementById('scrubber');
    const c = document.getElementById('carousel');
    if (!s || !c) return;
    const rect = s.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    c.scrollLeft = pct * (c.scrollWidth - c.clientWidth);
    syncScrubber();
}
function selectRace(id) { selectedRound = id; renderCarousel(); renderHub(); }

function updateCurrentBtn() {
    const btn = document.getElementById('btn-goto-current');
    if (!btn || !currentRound) { if (btn) btn.style.display = 'none'; return; }
    const el   = document.getElementById('carousel');
    const card = el?.querySelector(`[data-round-id="${currentRound.id}"]`);
    if (!card) { btn.style.display = 'none'; return; }
    const cr = el.getBoundingClientRect();
    const cc = card.getBoundingClientRect();
    btn.style.display = (cc.left < cr.right && cc.right > cr.left) ? 'none' : 'inline-flex';
}

function goToCurrent() {
    if (!currentRound) return;
    selectRace(currentRound.id);
    const el   = document.getElementById('carousel');
    const card = el?.querySelector(`[data-round-id="${currentRound.id}"]`);
    if (card && el) {
        const center = card.offsetLeft - (el.clientWidth / 2) + (card.offsetWidth / 2);
        el.scrollTo({ left: Math.max(0, center), behavior: 'smooth' });
    }
}


function allSessionsHtml(round) {
    const order = sessionOrder(round.fmt);
    const sess  = round.sessions ?? {};
    const now   = Date.now();
    return order.map(key => {
        const iso = sess[key]; if (!iso) return '';
        const start  = new Date(iso);
        const isPast = start.getTime() < now;
        const dateStr = start.toLocaleDateString('it-IT',{day:'2-digit',month:'short'}).toUpperCase();
        const timeStr = start.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
        const labelColor = isPast ? 'var(--text-muted)' : 'var(--text-main)';
        return `<div class="banner-sess-label" style="margin-bottom:.25rem;text-align:center">
            <i class="bi bi-clock me-1 align-middle"></i><span style="color:${labelColor};margin-left:.2rem">${SESSION_LABELS[key] ?? key.toUpperCase()}</span>
            <span style="color:var(--text-muted);font-size:.75rem"> — ${dateStr}, ${timeStr}</span>
        </div>`;
    }).join('');
}
// ── RACE HUB ──────────────────────────────────────────────
function renderHub() {
    const round  = REG.rounds.find(r => r.id === selectedRound);
    const hub    = document.getElementById('hub');
    if (!round) return;

    const status = getRoundStatus(round);
    const cc     = round.cc ?? 'un';
    const flag   = `<img src="https://flagcdn.com/w40/${cc}.png" class="card-db-flag" alt="${round.name}"> `;

    if (status === 'upcoming') {
        hub.innerHTML = `<div class="card-db text-center py-4">
            <div class="label mb-2">R${pad(round.n)} — UPCOMING ${round.fmt === 'spr' ? '— <span style="font-size:.82rem;color:var(--warn);font-weight:700">SPRINT</span>' : ''}</div>
            <div style="font-size:1.15rem;font-weight:700">${flag}${round.name.toUpperCase()}</div>
            <div class="label mt-1 mb-3 pb-3" style="border-bottom: 1px solid var(--border)">${round.date}</div>
            ${allSessionsHtml(round)}
        </div>`;
        return;
    }

    const rd = RESULTS[round.id];
    if (!rd) {
        hub.innerHTML = `<div class="card-db text-center py-4">
            <div class="label mb-2">R${pad(round.n)} — ${status.toUpperCase()} ${round.fmt === 'spr' ? '— <span style="font-size:.82rem;color:var(--warn);font-weight:700">SPRINT</span>' : ''}</div>
            <div style="font-size:1.15rem;font-weight:700">${flag}${round.name.toUpperCase()}</div>
            <div class="label mt-1 mb-3 pb-3" style="border-bottom: 1px solid var(--border)">${round.date}</div>
            ${allSessionsHtml(round)}
        </div>`;
        return;
    }

    const playersWithData = league().players
        .map(p => ({ p, rData: p.rounds[round.id] }))
        .sort((a, b) => (b.rData?.pts ?? -Infinity) - (a.rData?.pts ?? -Infinity));

    const maxPts = playersWithData[0]?.rData?.pts ?? -Infinity;

    hub.innerHTML = playersWithData.map(({ p, rData }) => {
        if (!rData) return `<div class="card-db"><span class="label">NO_DATA &mdash; ${p.name}</span></div>`;

        const isWinner = rData.pts === maxPts && maxPts > -Infinity;

        let dRows = `<div class="hub-row hub-row-hd"><div>DRIVER</div><div>PTS</div><div>XPT</div></div>`;
        [p.team.captain, ...p.team.drivers].forEach(d => {
            const dd  = rData.drivers[d]; if (!dd) return;
            const con = REG.drivers[d]?.constructor?.toLowerCase() ?? 'cad';
            dRows += `<div class="hub-row">
                <div class="driver-tag" style="border-color:var(--${con})">${d}${dd.isCap ? '<span class="x2">X2</span>' : ''}</div>
                <div class="${ptsClass(dd.isCap ? dd.pts * 2 : dd.pts)}">${dd.isCap ? dd.pts * 2 : dd.pts}</div>
                <div class="${ptsClass(dd.isCap ? dd.exp * 2 : dd.exp)}">${(dd.isCap ? dd.exp * 2 : dd.exp).toFixed(1)}</div>
            </div>`;
        });

        let cRows = `<div class="hub-row hub-row-hd" style="margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--border)"><div>CONSTRUCTOR</div><div>PTS</div><div>XPT</div></div>`;
        p.team.constructors.forEach(c => {
            const cd  = rData.constructors[c]; if (!cd) return;
            cRows += `<div class="hub-row">
                <div class="driver-tag" style="border-color:var(--${c.toLowerCase()})">${c}</div>
                <div class="${ptsClass(cd.pts)}">${cd.pts}</div>
                <div class="${ptsClass(cd.exp)}">${cd.exp.toFixed(1)}</div>
            </div>`;
        });

        const acc = rData.acc.toFixed(0);
        return `<div class="card-db"${isWinner ? ' style="border:1px solid var(--warn)"' : ''}>
            <div class="d-flex justify-content-between align-items-center bb pb-2 mb-2">
                <span style="font-weight:700">${p.code}<span style="margin-left:6px;font-size:.7rem;font-weight:400;color:var(--text-muted)">${p.name}</span></span>
                <div class="row d-flex align-items-center">
                    ${!isWinner && rData.pts !== maxPts 
                        ? `<div class="col-auto p-0" style="font-size:.7rem;color:var(--neg);">${rData.pts - maxPts}</div>` 
                    : `<div class="col-auto pos p-0" style="font-size:.7rem;">WINNER</div>`}
                    <span class="col" style="font-weight:700;color:${isWinner ? 'var(--warn)' : 'var(--text-main)'}">${rData.pts} PTS</span>
                </div>
            </div>
            ${dRows}${cRows}
            <div class="d-flex justify-content-between bt mt-3 pt-2" style="font-size:.8rem">
                <span class="muted">EXPECTED (XPT) <b style="color:var(--text-main)">${rData.exp.toFixed(1)}</b></span>
                <span class="muted">ACCURACY <b class="${accClass(+acc)}">${acc}%</b></span>
            </div>
        </div>`;
    }).join('');
}

// ── INIT ──────────────────────────────────────────────────
window.onload = async () => {
    await loadData();

    const key = new URLSearchParams(window.location.search).get('key');
    const lg  = key ? REG.championships.find(c => c.key === key) : null;

    if (!lg) {
        document.title = 'F1 FANTASY — NOT FOUND';
        document.body.innerHTML = `
            <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-base);font-family:'JetBrains Mono',monospace;padding:2rem">
                <div style="border:1px solid var(--border);border-left:3px solid var(--neg);padding:2rem;max-width:420px;width:100%">
                    <div style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5rem">F1_FANTASY_TRACKER // ${REG.season}</div>
                    <div style="font-size:1.4rem;font-weight:700;color:var(--neg);margin-bottom:1rem">ACCESS DENIED</div>
                    <div style="font-size:.88rem;color:var(--text-muted);margin-bottom:1.5rem;line-height:1.6">
                        ${key
                            ? `League <span style="color:var(--text-main);font-weight:700">"${key}"</span> not found.`
                            : 'No league key provided.'}
                        <br>Use a valid <span style="color:var(--accent)">?key=</span> parameter in the URL.
                    </div>
                    <div style="font-size:.75rem;color:var(--text-muted);border-top:1px solid var(--border);padding-top:1rem">
                        Contact the league admin for your access link.
                    </div>
                </div>
            </div>`;
        return;
    }

    activeKey = key;
    currentRound = deriveCurrentRound();
    nextRound = deriveNextRound(currentRound);
    precompute();

    document.getElementById('app-subtitle').textContent = `F1_FANTASY_TRACKER // ${REG.season}`;
    document.getElementById('league-name').textContent = lg.name;
    document.title = `${lg.name} // F1_FANTASY_TRACKER ${REG.season}`;

    selectedRound = currentRound?.id ?? REG.rounds[0].id;

    startClock();
    renderBanner();
    renderStandings();
    renderCarousel();
    renderHub();
};
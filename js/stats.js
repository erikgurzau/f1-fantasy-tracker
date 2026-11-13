// ── STATISTICS & ANALYTICS ───────────────────────────────
// Depends on: common.js, data.js, standings.js (activeRoster)

let statsPlayerFilter = '';   // player code, '' = all

function renderStats() {

    const wrap = document.getElementById('stats-wrap');
    if (!wrap) return;
    const players    = league().players;
    const doneRounds = REG.rounds.filter(r => isRoundComplete(r) || isRoundPartial(r));
    if (!doneRounds.length) {
        wrap.innerHTML = `<div class="stats-empty label">NO_DATA_YET — SEASON_NOT_STARTED</div>`;
        return;
    }
    wrap.innerHTML = `
        ${buildSeasonRecords(players, doneRounds)}
        ${buildPlayerFilter()}
        ${buildStatsShortcuts()}
        ${buildDriverStats(doneRounds)}
        ${buildConstructorStats(doneRounds)}
        ${buildPlayerStats(doneRounds)}
        <div class="mt-4">${buildSeasonTeamInsights()}</div>
    `;
}


// ── STATS SHORTCUTS ───────────────────────────────────────
function buildStatsShortcuts() {
    const shortcuts = [
        { id: 'stats-driver-section',      icon: './assets/icons/helmet-icon.png',      label: 'DRIVERS' },
        { id: 'stats-constructor-section', icon: './assets/icons/constructor-icon.png', label: 'CONSTRUCTORS', iconClass: 'stats-icon--constructor' },
        { id: 'stats-player-section',      icon: 'bi-people',                           label: 'PLAYERS' },
    ];
    return `
        <div class="stats-shortcuts" id="stats-shortcuts">
            ${shortcuts.map((s, i) => `
                <button class="stats-shortcut-btn${i === 0 ? ' active' : ''}" id="sc-${s.id}" onclick="
                    document.querySelectorAll('.stats-shortcut-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    const target = document.getElementById('${s.id}');
                    const shortcuts = document.getElementById('stats-shortcuts');
                    if (target && shortcuts) {
                        const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--navbar-h')) || 36;
                        const scH  = shortcuts.offsetHeight;
                        const y    = target.getBoundingClientRect().top + window.scrollY - navH - scH;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                ">
                    ${s.icon.startsWith('bi-') ? `<i class="bi ${s.icon}"></i>` : `<span class="stats-shortcut-icon${s.iconClass ? ' ' + s.iconClass : ''}" style="mask-image:url(${s.icon});-webkit-mask-image:url(${s.icon})"></span>`}
                    <span>${s.label}</span>
                </button>`).join('')}
        </div>`;
}

// ── SEASON RECORDS ────────────────────────────────────────
function buildSeasonRecords(players, doneRounds) {
    // Records consider COMPLETED rounds only (partial / not-updated rounds are ignored)
    const rounds = doneRounds.filter(r => isRoundComplete(r));
    if (!rounds.length) {
        return `
        <div class="label mb-2"><i class="bi bi-award me-2"></i>SEASON_RECORDS</div>
        <div class="stats-empty label mb-4">NO_COMPLETED_ROUNDS_YET</div>`;
    }

    const allRounds = rounds.flatMap(r =>
        players.map(p => ({ p, r, pts: p.rounds[r.id]?.pts ?? null })).filter(x => x.pts !== null)
    );

    const fi = (cc) => `<img src="https://flagcdn.com/w20/${cc ?? 'un'}.png" width="16" height="11" class="flag-inline">`;

    // best / worst single round — collect ALL tied entries
    const bestPts    = Math.max(...allRounds.map(x => x.pts));
    const worstPts   = Math.min(...allRounds.map(x => x.pts));
    const bestRounds  = allRounds.filter(x => x.pts === bestPts);
    const worstRounds = allRounds.filter(x => x.pts === worstPts);

    // win streaks — track start/end round of the best streak
    const streaksSorted = players.map(p => {
        let max = 0, cur = 0, curStart = null, bestStart = null, bestEnd = null;
        rounds.forEach(r => {
            const roundPts = players.map(pp => pp.rounds[r.id]?.pts ?? -Infinity);
            const myPts    = p.rounds[r.id]?.pts ?? -Infinity;
            if (myPts === Math.max(...roundPts) && myPts > -Infinity) {
                if (cur === 0) curStart = r;
                cur++;
                if (cur > max) { max = cur; bestStart = curStart; bestEnd = r; }
            } else {
                cur = 0; curStart = null;
            }
        });
        return { p, streak: max, bestStart, bestEnd };
    }).sort((a, b) => b.streak - a.streak);
    const bestStreakVal = streaksSorted[0].streak;
    const bestStreakers = streaksSorted.filter(x => x.streak === bestStreakVal);

    // most round wins — completed rounds only
    const winsByCode = {};
    players.forEach(p => { winsByCode[p.code] = 0; });
    rounds.forEach(r => {
        const roundPts = players.map(pp => pp.rounds[r.id]?.pts ?? -Infinity);
        const top      = Math.max(...roundPts);
        if (top === -Infinity) return;
        players.forEach(p => { if ((p.rounds[r.id]?.pts ?? -Infinity) === top) winsByCode[p.code]++; });
    });
    const mostWinsVal  = Math.max(...players.map(p => winsByCode[p.code]));
    const mostWinners  = players.filter(p => winsByCode[p.code] === mostWinsVal);

    // std dev / consistency
    const stdDevs = players.map(p => {
        const vals = rounds.map(r => p.rounds[r.id]?.pts ?? 0);
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
        const std  = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
        return { p, std, mean };
    }).sort((a, b) => a.std - b.std);
    const lowVarVal  = stdDevs[0].std;
    const highVarVal = stdDevs[stdDevs.length - 1].std;
    const lowVars    = stdDevs.filter(x => x.std === lowVarVal);
    const highVars   = stdDevs.filter(x => x.std === highVarVal);

    // avg per round
    const avgSorted = players.map(p => {
        const vals = rounds.map(r => p.rounds[r.id]?.pts ?? 0);
        const avg  = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
        return { p, avg };
    }).sort((a, b) => b.avg - a.avg);
    const highAvgVal = avgSorted[0].avg;
    const lowAvgVal  = avgSorted[avgSorted.length - 1].avg;
    const highAvgs   = avgSorted.filter(x => x.avg === highAvgVal);
    const lowAvgs    = avgSorted.filter(x => x.avg === lowAvgVal);

    // accuracy
    const accSorted   = [...players].map(p => ({ p, acc: p.totalAcc })).sort((a, b) => b.acc - a.acc);
    const bestAccVal  = accSorted[0].acc;
    const worstAccVal = accSorted[accSorted.length - 1].acc;
    const bestAccs    = accSorted.filter(x => x.acc === bestAccVal);
    const worstAccs   = accSorted.filter(x => x.acc === worstAccVal);

    // budget gain — price as of the last COMPLETED round
    const priceAsOf = (code, kind, init) => {
        for (let i = rounds.length - 1; i >= 0; i--) {
            const v = RESULTS[rounds[i].id]?.[kind]?.[code]?.price;
            if (v != null) return v;
        }
        return init;
    };
    const budgetSorted = players.map(p => {
        const allD = [p.team.captain, ...p.team.drivers];
        const gain = allD.reduce((s, d) => { const i0 = REG.drivers[d]?.init_price ?? 0; return s + (priceAsOf(d, 'drivers', i0) - i0); }, 0)
                   + p.team.constructors.reduce((s, c) => { const i0 = REG.constructors[c]?.init_price ?? 0; return s + (priceAsOf(c, 'constructors', i0) - i0); }, 0);
        return { p, gain };
    }).sort((a, b) => b.gain - a.gain);
    const topBudgetVal = budgetSorted[0].gain;
    const botBudgetVal = budgetSorted[budgetSorted.length - 1].gain;
    const topBudgets   = budgetSorted.filter(x => x.gain === topBudgetVal);
    const botBudgets   = budgetSorted.filter(x => x.gain === botBudgetVal);

    // items: subs = array of { code, extra, streakInfo } — supports multiple tied players
    const items = [
        { icon:'bi-trophy warn',           label:'MOST_WINS',
          val:`${mostWinsVal}`,             unit: mostWinsVal !== 1 ? 'WINS' : 'WIN',
          subs: mostWinners.map(p => ({ code: p.code, extra: null })) },

        { icon:'bi-fire warn',             label:'BEST_WIN_STREAK',
          val:`${bestStreakVal}`,            unit: bestStreakVal !== 1 ? 'ROUNDS' : 'ROUND',
          subs: bestStreakers.map((x, i) => ({
              code: x.p.code,
              extra: null,
              streakInfo: (x.bestStart && x.bestEnd) ? { start: x.bestStart, end: x.bestEnd, ttId: `streak-tt-${i}` } : null
          })) },

        { icon:'bi-arrow-up-circle pos',   label:'BEST_ROUND',
          val:`${bestPts}`,                 unit:'PTS',
          subs: bestRounds.map(x => ({ code: x.p.code, extra: `${fi(x.r.cc)} ${pad(x.r.name)}` })) },

        { icon:'bi-arrow-down-circle neg', label:'WORST_ROUND',
          val:`${worstPts}`,                unit:'PTS',
          subs: worstRounds.map(x => ({ code: x.p.code, extra: `${fi(x.r.cc)} ${pad(x.r.name)}` })) },

        { icon:'bi-bar-chart-line pos',    label:'HIGHEST_AVG',
          val: highAvgVal.toFixed(1),       unit:'PTS',
          subs: highAvgs.map(x => ({ code: x.p.code, extra: null })) },

        { icon:'bi-bar-chart-line neg rotate-y-180',    label:'LOWEST_AVG',
          val: lowAvgVal.toFixed(1),        unit:'PTS',
          subs: lowAvgs.map(x => ({ code: x.p.code, extra: null })) },

        { icon:'bi-graph-up-arrow pos',    label:'BEST_BUDGET',
          val:`${topBudgetVal >= 0 ? '+' : ''}${topBudgetVal.toFixed(1)}`, unit:'M',
          subs: topBudgets.map(x => ({ code: x.p.code, extra: null })) },

        { icon:'bi-graph-down-arrow neg',  label:'WORST_BUDGET',
          val:`${botBudgetVal >= 0 ? '+' : ''}${botBudgetVal.toFixed(1)}`, unit:'M',
          subs: botBudgets.map(x => ({ code: x.p.code, extra: null })) },
    ];

    const cells = items.map(({ icon, label, val, unit, subs }) => {
        const subTags = subs.map(({ code, extra, streakInfo }) => {
            let infoIcon = '';
            if (streakInfo) {
                const { start, end, ttId } = streakInfo;
                const sameRound = start.id === end.id;
                const tooltipContent = sameRound
                    ? `<span class="xpt-tooltip-label">ROUND_${pad(start.n)}</span>
                       <span style="display:flex;align-items:center;gap:.35rem;margin-top:3px">
                           <img src="https://flagcdn.com/w40/${start.cc ?? 'un'}.png" width="20" height="13" style="border:1px solid var(--border)">
                           <span style="font-size:.78rem;color:var(--text-main)">${start.name.toUpperCase()}</span>
                       </span>`
                    : `<span class="xpt-tooltip-label">R${pad(start.n)} → R${pad(end.n)}</span>
                       <span style="display:flex;align-items:center;gap:.35rem;margin-top:3px">
                           <img src="https://flagcdn.com/w40/${start.cc ?? 'un'}.png" width="20" height="13" style="border:1px solid var(--border)">
                           <span style="font-size:.78rem;color:var(--text-main)">${start.name.toUpperCase()}</span>
                       </span>
                       <span style="display:flex;align-items:center;gap:.35rem;margin-top:3px">
                           <img src="https://flagcdn.com/w40/${end.cc ?? 'un'}.png" width="20" height="13" style="border:1px solid var(--border)">
                           <span style="font-size:.78rem;color:var(--text-main)">${end.name.toUpperCase()}</span>
                       </span>`;
                infoIcon = `<span class="xpt-tooltip-wrap" onclick="toggleXptTooltip('${ttId}')">
                    <i class="bi bi-info-circle xpt-info-icon"></i>
                    <span class="xpt-tooltip" id="${ttId}">${tooltipContent}</span>
                </span>`;
            }
            return `<span class="rec-sub-row">
                <span class="rec-sub"><span class="fw-bold">${code}</span></span>${extra ? `<span class="rec-sub-extra muted text-uppercase">${extra}</span>` : ''}${infoIcon}
            </span>`;
        }).join('');
        return `
        <div class="rec-cell">
            <div class="rec-cell-top">
                <i class="bi ${icon} rec-icon"></i>
                <span class="label rec-label">${label}</span>
            </div>
            <div class="rec-val">${val}<span class="rec-unit"> ${unit}</span></div>
            <div class="rec-subs">${subTags}</div>
        </div>`;
    }).join('');

    return `
        <div class="label mb-2"><i class="bi bi-award me-2"></i>SEASON_RECORDS</div>
        <div class="rec-grid b mb-4">${cells}</div>`;
}

// ── SEASON BEST TEAM ──────────────────────────────────────
// Same logic as buildTeamInsights() in hub.js, but over the whole season:
// the 5 drivers (captain ×2) + 2 constructors with the most points summed over
// every COMPLETED round, within a budget. The team is held for the whole season.
let seasonTeamBudget  = 100;
let seasonTeamUseInit = true;    // true = INIT prices (default), false = CURR prices

function pickSeasonBestTeam(drvPool, conPool, budget) {
    const EPS = 1e-9;                       // float-safe budget comparison
    let best = null, bestScore = -Infinity;
    const set = [];

    for (let i = 0; i < conPool.length; i++) {
        for (let j = i + 1; j < conPool.length; j++) {
            const c1 = conPool[i], c2 = conPool[j];
            const conPrice = c1.price + c2.price;
            const conPts   = c1.pts + c2.pts;
            if (conPrice >= budget) continue;

            const walk = (start, need, rem, pts, spent) => {
                if (need === 0) {
                    let cap = set[0];
                    for (let k = 1; k < set.length; k++) if (set[k].pts > cap.pts) cap = set[k];
                    const score = conPts + pts + cap.pts;          // captain bonus
                    if (score > bestScore) {
                        bestScore = score;
                        best = { drv: [...set], cons: [c1, c2], captain: cap, totalPts: score, spent: conPrice + spent };
                    }
                    return;
                }
                if (start > drvPool.length - need) return;
                for (let k = start; k < drvPool.length; k++) {
                    const d = drvPool[k];
                    if (d.price <= rem + EPS) {
                        set.push(d);
                        walk(k + 1, need - 1, rem - d.price, pts + d.pts, spent + d.price);
                        set.pop();
                    }
                }
            };
            walk(0, 5, budget - conPrice, 0, 0);
        }
    }
    return best;
}

function buildSeasonTeamInsights() {
    return `<div id="season-team-wrap">${buildSeasonTeamInner()}</div>`;
}

function buildSeasonTeamInner() {
    const BUDGET = seasonTeamBudget;
    const useInit = seasonTeamUseInit;
    const rounds = REG.rounds.filter(r => isRoundComplete(r));

    const header = `<div class="label mb-2"><i class="bi bi-stars me-2"></i>SEASON_INSIGHTS</div>`;
    if (!rounds.length) {
        return `${header}<div class="stats-empty label mb-4">NO_COMPLETED_ROUNDS_YET</div>`;
    }

    // season points per driver / constructor (completed rounds only)
    const sum = (kind, code) => {
        let pts = 0, n = 0;
        rounds.forEach(r => {
            const e = RESULTS[r.id]?.[kind]?.[code];
            if (e) { pts += e.pts ?? 0; n++; }
        });
        return n ? pts : null;
    };
    const drvPrice = code => useInit
        ? (REG.drivers[code]?.init_price ?? 0)
        : (latestPrice(code, 'drivers') ?? REG.drivers[code]?.init_price ?? 0);
    const conPrice = code => useInit
        ? (REG.constructors[code]?.init_price ?? 0)
        : (latestPrice(code, 'constructors') ?? REG.constructors[code]?.init_price ?? 0);

    const allDrivers = Object.keys(REG.drivers)
        .map(code => ({ code, pts: sum('drivers', code), price: drvPrice(code) }))
        .filter(d => d.pts !== null)
        .sort((a, b) => b.pts - a.pts);
    const allCons = Object.keys(REG.constructors)
        .map(code => ({ code, pts: sum('constructors', code), price: conPrice(code) }))
        .filter(c => c.pts !== null)
        .sort((a, b) => b.pts - a.pts);

    const minCost = [...allDrivers].sort((a, b) => a.price - b.price).slice(0, 5).reduce((s, d) => s + d.price, 0)
                  + [...allCons].sort((a, b) => a.price - b.price).slice(0, 2).reduce((s, c) => s + c.price, 0);
    const infeasible = allDrivers.length < 5 || allCons.length < 2 || minCost > BUDGET;
    const team = infeasible ? null : pickSeasonBestTeam(allDrivers, allCons, BUDGET);

    const config = `
        <div class="insights-config-panel">
            <div class="insights-config-row">
                <span class="label col text-right"><i class="bi bi-cash me-2"></i>BUDGET</span>
                <div class="col text-right">
                    <input type="number" min="10" max="200" step="0.5" value="${BUDGET}"
                        class="budget-input"
                        onchange="setSeasonTeamBudget(+this.value)">
                    <span class="muted" style="font-size:.82rem">M</span>
                </div>
            </div>
            <div class="insights-config-sep"></div>
            <div class="insights-config-row">
                <span class="label col text-right"><i class="bi bi-tag me-2"></i>PRICE_MODE</span>
                <div class="col text-right">
                    <label class="insights-toggle-wrap">
                        <input type="checkbox" class="insights-toggle-cb" ${useInit ? 'checked' : ''}
                            onchange="toggleSeasonTeamPrice()">
                        <span class="insights-toggle-track">
                            <span class="insights-toggle-thumb"></span>
                        </span>
                        <span class="insights-toggle-label">${useInit ? 'INIT' : 'CURR'}</span>
                    </label>
                </div>
            </div>
        </div>`;

    if (!team) {
        const msg = (allDrivers.length < 5 || allCons.length < 2)
            ? 'NOT_ENOUGH_DATA — need at least 5 drivers + 2 constructors'
            : `BUDGET_TOO_LOW — min required: ${minCost.toFixed(1)}M for 5 drivers + 2 constructors`;
        return `${header}${config}
            <div class="card-db mb-4" style="border-color:var(--neg);color:var(--text-muted);font-size:.82rem">
                <i class="bi bi-exclamation-triangle neg me-2"></i>${msg}
            </div>`;
    }

    const dRows = team.drv.map(d => {
        const isCap = d === team.captain;
        const pts   = isCap ? d.pts * 2 : d.pts;
        const con   = REG.drivers[d.code]?.constructor?.toLowerCase() ?? 'cad';
        return `
            <div class="hub-row">
                <div class="driver-tag" style="border-color:var(--${con})">
                    ${d.code}${isCap ? '<span class="x2">X2</span>' : ''}
                </div>
                <div class="${ptsClass(pts)}">${pts}</div>
                <div class="muted" style="font-size:.78rem">${d.price.toFixed(1)}M</div>
            </div>`;
    }).join('');
    const cRows = team.cons.map(c => `
            <div class="hub-row">
                <div class="driver-tag" style="border-color:var(--${c.code.toLowerCase()})">${c.code}</div>
                <div class="${ptsClass(c.pts)}">${c.pts}</div>
                <div class="muted" style="font-size:.78rem">${c.price.toFixed(1)}M</div>
            </div>`).join('');

    const first = rounds[0], last = rounds[rounds.length - 1];
    const rangeTag = `<div class="s-player-name ps-4">${rounds.length === 1
        ? `R${pad(first.n)}`
        : `R${pad(first.n)} → R${pad(last.n)}`} · ${rounds.length} ${rounds.length === 1 ? 'ROUND' : 'ROUNDS'}</div>`;

    return `${header}${config}
        <div class="card-db mb-4">
            <div class="card-header-row bb pb-2 mb-2">
                <div class="card-header-left">
                    <div class="s-code"><i class="bi bi-arrow-up-circle pos me-2"></i>BEST_TEAM</div>
                    ${rangeTag}
                </div>
                <div class="card-header-right">
                    <div class="card-pts ${team.totalPts > 0 ? 'pos' : 'neg'}">${team.totalPts} PTS</div>
                    <div class="card-gap muted">${team.spent.toFixed(1)}M / ${BUDGET}M</div>
                </div>
            </div>
            <div class="hub-row hub-row-hd"><div>DRIVER</div><div>PTS</div><div>PRICE</div></div>
            ${dRows}
            <div class="hub-row hub-row-hd hub-section-sep"><div>CONSTRUCTOR</div><div>PTS</div><div>PRICE</div></div>
            ${cRows}
        </div>`;
}

function refreshSeasonTeam() {
    const el = document.getElementById('season-team-wrap');
    if (el) el.innerHTML = buildSeasonTeamInner();
}
function setSeasonTeamBudget(v) {
    seasonTeamBudget = Number.isFinite(v) && v > 0 ? v : 100;
    refreshSeasonTeam();
}
function toggleSeasonTeamPrice() {
    seasonTeamUseInit = !seasonTeamUseInit;
    refreshSeasonTeam();
}

// ── PLAYER FILTER (shared, above driver + constructor sections) ───
function buildPlayerFilter() {
    const players = league().players;

    const opts = players.map(p => `
        <div class="h2h-opt${statsPlayerFilter === p.code ? ' h2h-opt--active' : ''}"
             onclick="setStatsPlayerFilter('${p.code}');closeStatsDropdown()">
            <span>${p.code}</span>
            <span class="h2h-opt-name muted">${p.name}</span>
        </div>`).join('');

    const noPlayerSelected = '[NO_PLAYER]';
    const selected = players.find(p => p.code === statsPlayerFilter);
    const btnLabel = selected
        ? `<span>${selected.code}</span><span class="h2h-opt-name muted">${selected.name}</span>`
        : `<span class="muted">${noPlayerSelected}</span>`;

    const allOpt = `
        <div class="h2h-opt${statsPlayerFilter === '' ? ' h2h-opt--active' : ''}"
             onclick="setStatsPlayerFilter('');closeStatsDropdown()">
            <span class="muted">${noPlayerSelected}</span>
        </div>`;

    return `
        <div class="stats-player-filter mb-3">
            <span class="label"><i class="bi bi-funnel me-2"></i>FILTER_BY_PLAYER</span>
            <div class="h2h-dropdown" id="stats-dd-player">
                <button class="h2h-dd-btn" onclick="toggleStatsDropdown()">
                    ${btnLabel}
                    <i class="bi bi-chevron-down h2h-dd-chevron"></i>
                </button>
                <div class="h2h-dd-list">${allOpt}${opts}</div>
            </div>
        </div>`;
}

function toggleStatsDropdown() {
    document.getElementById('stats-dd-player')?.classList.toggle('open');
}

function closeStatsDropdown() {
    document.getElementById('stats-dd-player')?.classList.remove('open');
}

document.addEventListener('click', e => {
    if (!e.target.closest('#stats-dd-player')) closeStatsDropdown();
}, true);

function setStatsPlayerFilter(val) {
    statsPlayerFilter = val;
    const doneRounds = REG.rounds.filter(r => isRoundComplete(r) || isRoundPartial(r));
    // Re-render filter panel to update button label
    const filterEl = document.querySelector('.stats-player-filter');
    if (filterEl) filterEl.outerHTML = buildPlayerFilter();
    const dSec = document.getElementById('stats-driver-section');
    const cSec = document.getElementById('stats-constructor-section');
    if (dSec) dSec.outerHTML = buildDriverStats(doneRounds);
    if (cSec) cSec.outerHTML = buildConstructorStats(doneRounds);
    const pSec = document.getElementById('stats-player-section');
    if (pSec) pSec.outerHTML = buildPlayerStats(doneRounds);
}

function getPlayerDriverCodes(playerCode) {
    if (!playerCode) return null;
    const p = league().players.find(x => x.code === playerCode);
    if (!p) return null;
    const codes = new Set([p.team.captain, ...p.team.drivers]);
    (p.transfers ?? []).forEach(t => { [t.out, t.in].forEach(c => { if (REG.drivers[c]) codes.add(c); }); });
    return codes;
}

function getPlayerConstructorCodes(playerCode) {
    if (!playerCode) return null;
    const p = league().players.find(x => x.code === playerCode);
    if (!p) return null;
    const codes = new Set(p.team.constructors);
    (p.transfers ?? []).forEach(t => { [t.out, t.in].forEach(c => { if (REG.constructors[c]) codes.add(c); }); });
    return codes;
}

// ── DRIVER STATS ──────────────────────────────────────────
function buildDriverStats(rounds) {
    const allPlayers   = league().players;
    const totalPlayers = allPlayers.length || 1;

    let drivers = Object.entries(REG.drivers).map(([code, info]) => {
        let totalPts = 0, totalExp = 0, count = 0, bestP = -Infinity, worstP = Infinity, bestR = null, worstR = null;
        const roundBreakdown = [];
        rounds.forEach(r => {
            const d = RESULTS[r.id]?.drivers?.[code]; if (!d) return;
            const p = d.pts ?? 0;
            totalPts += p; totalExp += d.exp ?? 0; count++;
            if (isRoundComplete(r)) {
                if (p > bestP)  { bestP = p;  bestR = r; }
                if (p < worstP) { worstP = p; worstR = r; }
                roundBreakdown.push({ r, pts: p });
            }
        });
        if (!count) return null;
        const initP    = info.init_price;
        const currP    = latestPrice(code, 'drivers') ?? initP;
        const avgPts   = totalPts / count;
        const acc      = totalExp !== 0 ? Math.max(0, 100 - Math.abs(totalPts - totalExp) / Math.abs(totalExp) * 100) : 0;
        const selCount = allPlayers.filter(p =>
            activeRoster([p.team.captain, ...p.team.drivers], p).includes(code)
        ).length;
        return { code, name: info.name, con: info.constructor.toLowerCase(),
            totalPts, totalExp, initP, currP, priceDiff: currP - initP,
            avgPts, ptsPerM: currP > 0 ? totalPts / currP : 0, acc, bestP, worstP, bestR, worstR, selCount, totalPlayers, roundBreakdown };
    }).filter(Boolean).sort((a, b) => b.totalPts - a.totalPts);

    const allowedCodes = getPlayerDriverCodes(statsPlayerFilter);
    if (allowedCodes) drivers = drivers.filter(d => allowedCodes.has(d.code));

    const inner = drivers.length
        ? `<div class="stat-table">${drivers.map((d, i) => buildStatCardRow(
            i+1, `var(--${d.con})`, d.code, d.name, d.totalPts, d.avgPts, d.ptsPerM, d.priceDiff,
            d.acc, d.totalExp, d.bestP, d.worstP, d.bestR, d.worstR, i===0, d.initP, d.currP, d.selCount, d.totalPlayers,
            buildRoundAccordion('drv', d.code, d.roundBreakdown)
          )).join('')}</div>`
        : `<div class="stat-table b"><div class="stats-empty label">NO_DATA FOR SELECTED PLAYER</div></div>`;

    return `<div id="stats-driver-section">
        <div class="label mb-2"><span class="stats-section-icon" style="mask-image:url(./assets/icons/helmet-icon.png);-webkit-mask-image:url(./assets/icons/helmet-icon.png)"></span>DRIVERS</div>
        ${inner}
    </div>`;
}

// ── CONSTRUCTOR STATS ─────────────────────────────────────
function buildConstructorStats(rounds) {
    const allPlayers2   = league().players;
    const totalPlayers2 = allPlayers2.length || 1;
    const conPicks = {};
    allPlayers2.forEach(p => {
        activeRoster(p.team.constructors, p).forEach(c => { conPicks[c] = (conPicks[c] ?? 0) + 1; });
    });

    let constructors = Object.entries(REG.constructors).map(([code, info]) => {
        let totalPts = 0, totalExp = 0, count = 0, bestP = -Infinity, worstP = Infinity, bestR = null, worstR = null;
        const roundBreakdown = [];
        rounds.forEach(r => {
            const c = RESULTS[r.id]?.constructors?.[code]; if (!c) return;
            const p = c.pts ?? 0;
            totalPts += p; totalExp += c.exp ?? 0; count++;
            if (isRoundComplete(r)) {
                if (p > bestP)  { bestP = p;  bestR = r; }
                if (p < worstP) { worstP = p; worstR = r; }
                roundBreakdown.push({ r, pts: p });
            }
        });
        if (!count) return null;
        const initP = info.init_price, currP = latestPrice(code,'constructors') ?? initP;
        const avgPts = totalPts / count;
        const acc    = totalExp !== 0 ? Math.max(0, 100 - Math.abs(totalPts - totalExp) / Math.abs(totalExp) * 100) : 0;
        const selCount = conPicks[code] ?? 0;
        return { code, name: info.name, totalPts, totalExp, initP, currP, priceDiff: currP - initP,
            avgPts, ptsPerM: currP > 0 ? totalPts / currP : 0, acc, bestP, worstP, bestR, worstR, selCount, roundBreakdown };
    }).filter(Boolean).sort((a, b) => b.totalPts - a.totalPts);

    const allowedCodes = getPlayerConstructorCodes(statsPlayerFilter);
    if (allowedCodes) constructors = constructors.filter(c => allowedCodes.has(c.code));

    const inner = constructors.length
        ? `<div class="stat-table">${constructors.map((c, i) => buildStatCardRow(
            i+1, `var(--${c.code.toLowerCase()})`, c.code, c.name, c.totalPts, c.avgPts, c.ptsPerM, c.priceDiff,
            c.acc, c.totalExp, c.bestP, c.worstP, c.bestR, c.worstR, i===0, c.initP, c.currP, c.selCount, totalPlayers2,
            buildRoundAccordion('con', c.code, c.roundBreakdown)
          )).join('')}</div>`
        : `<div class="stat-table b"><div class="stats-empty label">NO_DATA FOR SELECTED PLAYER</div></div>`;

    return `<div id="stats-constructor-section">
        <div class="label mt-4 mb-2"><span class="stats-section-icon stats-icon--constructor" style="mask-image:url(./assets/icons/constructor-icon.png);-webkit-mask-image:url(./assets/icons/constructor-icon.png)"></span>CONSTRUCTORS</div>
        ${inner}
    </div>`;
}


// ── PLAYER STATS ──────────────────────────────────────────
function buildPlayerStats(rounds) {
    const allPlayers   = league().players;

    let players = allPlayers.map(p => {
        let totalPts = 0, totalExp = 0, count = 0, bestP = -Infinity, worstP = Infinity, bestR = null, worstR = null;
        const roundBreakdown = [];
        rounds.forEach(r => {
            const rd = p.rounds[r.id]; if (!rd) return;
            const pts = rd.pts ?? 0;
            totalPts += pts; totalExp += rd.exp ?? 0; count++;
            if (isRoundComplete(r)) {
                if (pts > bestP)  { bestP = pts;  bestR = r; }
                if (pts < worstP) { worstP = pts; worstR = r; }
                roundBreakdown.push({ r, pts });
            }
        });
        if (!count) return null;
        const avgPts = totalPts / count;
        const acc    = totalExp !== 0 ? Math.max(0, 100 - Math.abs(totalPts - totalExp) / Math.abs(totalExp) * 100) : 0;
        return { code: p.code, name: p.name, totalPts, totalExp, avgPts, acc,
                 bestP, worstP, bestR, worstR, wins: p.wins,
                 budgetInit: p.budgetInit, budgetCurr: p.budgetCurr, roundBreakdown };
    }).filter(Boolean).sort((a, b) => b.totalPts - a.totalPts);

    if (statsPlayerFilter) players = players.filter(p => p.code === statsPlayerFilter);

    const sc = (label, val, cls = '') =>
        `<div class="sc"><div class="sl">${label}</div><div class="sv${cls ? ' '+cls : ''}">${val}</div></div>`;

    const inner = players.length
        ? `<div class="stat-table">${players.map((p, i) => {
            const isTop = i === 0;
            const ptsC  = isTop ? 'warn' : p.totalPts < 0 ? 'neg' : '';
            const uid   = `tt-player-${p.code}`;
            const gap   = p.totalPts - players[0].totalPts;

            function roundTooltipCell(label, pts, round, ttId, cls) {
                const roundInfo = round
                    ? `<span class="xpt-tooltip-label">ROUND_${pad(round.n)}</span>
                       <span style="display:flex;align-items:center;gap:.35rem;margin-top:3px">
                           <img src="https://flagcdn.com/w40/${round.cc ?? 'un'}.png" width="20" height="13" style="border:1px solid var(--border)">
                           <span style="font-size:.78rem;color:var(--text-main)">${round.name.toUpperCase()}</span>
                       </span>`
                    : `<span class="xpt-tooltip-label">—</span>`;
                return `<div class="sc"><div class="sl">${label}</div>
                    <div class="sv${cls ? ' '+cls : ''}" style="display:flex;align-items:center;gap:.3rem;">
                        ${pts}
                        <span class="xpt-tooltip-wrap" onclick="toggleXptTooltip('${ttId}')">
                            <i class="bi bi-info-circle xpt-info-icon"></i>
                            <span class="xpt-tooltip" id="${ttId}">${roundInfo}</span>
                        </span>
                    </div></div>`;
            }

            const accCell = `<div class="sc"><div class="sl">ACCURACY_XPT</div>
                <div class="sv ${accClass(p.acc)}" style="display:flex;align-items:center;gap:.3rem;">
                    ${p.acc.toFixed(0)}%
                    <span class="xpt-tooltip-wrap" onclick="toggleXptTooltip('${uid}')">
                        <i class="bi bi-info-circle xpt-info-icon"></i>
                        <span class="xpt-tooltip" id="${uid}">
                            <span class="xpt-tooltip-label">TOT_XPT</span>
                            <span class="xpt-tooltip-val">${p.totalExp.toFixed(1)}</span>
                        </span>
                    </span>
                </div></div>`;

            return `
                <div class="stat-card-row px-2 pb-2 pt-1 ${isTop ? 'stat-card-row--winner' : ''}">
                    <div class="stat-top">
                        <div class="stat-id">
                            <div class="s-rank">${i + 1}</div>
                            <div class="stat-name" style="min-width:0;overflow:hidden;">
                                <span class="fw-bold" style="flex-shrink:0;">${p.code}</span>
                                <span class="s-player-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</span>
                            </div>
                        </div>
                        <div class="stat-kpis">
                            <div class="sc text-right">
                                <div class="sl">TOT_PTS</div>
                                <div class="sv fw-bold${ptsC ? ' '+ptsC : ''}">
                                    <span class="diff-small ${gap < 0 ? 'neg' : gap === 0 ? 'muted' : 'pos'}" style="font-size:.65rem;margin-left:3px;">${gap === 0 ? '' : gap}</span>
                                    ${p.totalPts}
                                </div>
                            </div>
                        </div>
                    </div>
                    ${buildStatsAccordion(`${uid}-stats`, `<div class="stat-secondary">
                        <div class="stat-sec-row">
                            ${sc('AVG_PTS/RND', p.avgPts.toFixed(1), p.avgPts < 0 ? 'neg' : '')}
                            ${sc('PTS/M', (p.totalPts / (p.budgetCurr || 1)).toFixed(1))}
                            ${accCell}
                        </div>
                        <div class="stat-sec-row">
                            ${sc('WINS', p.wins, p.wins === 0 ? 'muted' : 'warn')}
                            ${roundTooltipCell('HIGHEST_PTS', p.bestP, p.bestR, `${uid}-best`, p.bestP < 0 ? 'neg' : '')}
                            ${roundTooltipCell('LOWEST_PTS',  p.worstP, p.worstR, `${uid}-worst`, p.worstP < 0 ? 'neg' : '')}
                        </div>
                        <div class="stat-sec-row">
                            ${sc('INIT_BUDGET', p.budgetInit.toFixed(1)+'M')}
                            ${sc('CURR_BUDGET', p.budgetCurr.toFixed(1)+'M')}
                            ${sc('DIFF_BUDGET', diffHtml(p.budgetCurr - p.budgetInit, false))}
                        </div>
                    </div>`)}
                    ${buildRoundAccordion('pr', p.code, p.roundBreakdown)}
                </div>`;
          }).join('')}</div>`
        : `<div class="stat-table b"><div class="stats-empty label">NO_DATA FOR SELECTED PLAYER</div></div>`;

    return `<div id="stats-player-section">
        <div class="label mt-4 mb-2"><i class="bi bi-people me-2"></i>PLAYERS</div>
        ${inner}
    </div>`;
}

// ── ROUND BREAKDOWN ACCORDION (players & drivers) ─────────
function buildRoundAccordion(idPrefix, code, roundBreakdown) {
    if (!roundBreakdown || !roundBreakdown.length) return '';
    const accId = `${idPrefix}-acc-${code}`;
    const maxPts = Math.max(...roundBreakdown.map(x => x.pts));
    const rows = roundBreakdown.map(({ r, pts }) => {
        const isBest = pts === maxPts;
        const cls = isBest ? 'warn' : pts < 0 ? 'neg' : '';
        return `
        <div class="player-round-row">
            <div class="player-round-info">
                ${flagImg(r.cc, r.name, 'player-round-flag')}
                <span class="player-round-label">R${pad(r.n)}</span>
                <span class="player-round-name">${r.name.toUpperCase()}</span>
                <span class="player-round-date">${(r.date ?? '').toUpperCase()}</span>
            </div>
            <div class="player-round-pts fw-bold${cls ? ' ' + cls : ''}">${pts}</div>
        </div>`;
    }).join('');

    return `
        <div class="player-round-toggle" onclick="toggleDetail('${accId}',this)">
            <span class="label">ROUND_BREAKDOWN</span>
            <i class="bi bi-chevron-down s-chevron ms-2"></i>
        </div>
        <div class="standings-detail player-round-detail" id="${accId}">
            ${rows}
        </div>`;
}

// ── STATS ACCORDION (collapsed by default, same look as ROUND_BREAKDOWN) ──
function buildStatsAccordion(accId, innerHtml, label = 'STATS_DETAILS') {
    return `
        <div class="player-round-toggle" onclick="toggleDetail('${accId}',this)">
            <span class="label">${label}</span>
            <i class="bi bi-chevron-down s-chevron ms-2"></i>
        </div>
        <div class="standings-detail player-round-detail" id="${accId}">
            ${innerHtml}
        </div>`;
}

// ── SHARED ROW BUILDER ────────────────────────────────────
function buildStatCardRow(rank, tagColor, code, name, totalPts, avgPts, ptsPerM, priceDiff, acc, totalExp, bestP, worstP, bestR, worstR, isTop, initP, currP, selCount = null, totalPlayers = null, roundHtml = '') {
    const ptsC = isTop ? 'warn' : totalPts < 0 ? 'neg' : '';
    const sc   = (label, val, cls = '') =>
        `<div class="sc"><div class="sl">${label}</div><div class="sv${cls ? ' '+cls : ''}">${val}</div></div>`;

    const uid = `tt-${code}-${rank}`;

    function roundTooltipCell(label, pts, round, ttId, cls) {
        const roundInfo = round
            ? `<span class="xpt-tooltip-label">ROUND_${pad(round.n)}</span>
               <span style="display:flex;align-items:center;gap:.35rem;margin-top:3px">
                   <img src="https://flagcdn.com/w40/${round.cc ?? 'un'}.png" width="20" height="13" style="border:1px solid var(--border)">
                   <span style="font-size:.78rem;color:var(--text-main)">${round.name.toUpperCase()}</span>
               </span>`
            : `<span class="xpt-tooltip-label">—</span>`;
        return `
            <div class="sc">
                <div class="sl">${label}</div>
                <div class="sv${cls ? ' ' + cls : ''}" style="display:flex;align-items:center;gap:.3rem;">
                    ${pts}
                    <span class="xpt-tooltip-wrap" onclick="toggleXptTooltip('${ttId}')">
                        <i class="bi bi-info-circle xpt-info-icon"></i>
                        <span class="xpt-tooltip" id="${ttId}">${roundInfo}</span>
                    </span>
                </div>
            </div>`;
    }

    const accCell = `
        <div class="sc">
            <div class="sl">ACCURACY_XPT</div>
            <div class="sv ${accClass(acc)}" style="display:flex;align-items:center;gap:.3rem;">
                ${acc.toFixed(0)}%
                <span class="xpt-tooltip-wrap" onclick="toggleXptTooltip('${uid}')">
                    <i class="bi bi-info-circle xpt-info-icon"></i>
                    <span class="xpt-tooltip" id="${uid}">
                        <span class="xpt-tooltip-label">TOT_XPT</span>
                        <span class="xpt-tooltip-val">${totalExp.toFixed(1)}</span>
                    </span>
                </span>
            </div>
        </div>`;

    return `
        <div class="stat-card-row px-2 pb-2 pt-1 ${isTop ? 'stat-card-row--winner' : ''}">
            <div class="stat-top">
                <div class="stat-id">
                    <div class="s-rank">${rank}</div>
                    <div class="driver-tag" style="border-color:${tagColor}">${code}</div>
                    <div class="stat-name">
                        <div class="s-player-name">${name}</div>
                    </div>
                </div>
                <div class="stat-kpis">
                    <div class="sc text-right">
                        <div class="sl">TOT_PTS</div>
                        <div class="sv fw-bold${ptsC ? ' '+ptsC : ''}">${totalPts}</div>
                    </div>
                </div>
            </div>
            ${buildStatsAccordion(`${uid}-stats`, `<div class="stat-secondary">
                <div class="stat-sec-row">
                    ${sc('AVG_PTS/RND', avgPts.toFixed(1), avgPts < 0 ? 'neg' : '')}
                    ${sc('PTS/M',   ptsPerM.toFixed(1), ptsPerM < 0 ? 'neg' : '')}
                    ${accCell}
                </div>
                <div class="stat-sec-row">
                    ${sc('SELECTED', selCount !== null ? (totalPlayers !== null ? selCount + '/' + totalPlayers : selCount) : '—', !selCount || selCount == 0 ? 'muted' : '')}
                    ${roundTooltipCell('HIGHEST_PTS', bestP, bestR, `${uid}-best`, bestP < 0 ? 'neg' : '')}
                    ${roundTooltipCell('LOWEST_PTS',  worstP, worstR, `${uid}-worst`, worstP < 0 ? 'neg' : '')}
                </div>
                <div class="stat-sec-row">
                    ${sc('INIT_PRICE', initP.toFixed(1)+'M')}
                    ${sc('CURR_PRICE', currP.toFixed(1)+'M')}
                    ${sc('DIFF_PRICE', diffHtml(priceDiff, false))}
                </div>
            </div>`)}
            ${roundHtml}
        </div>`;
}
function toggleXptTooltip(id) {
    const tt = document.getElementById(id);
    if (!tt) return;
    const isOpen = tt.classList.toggle('open');
    if (isOpen) {
        // close all others
        document.querySelectorAll('.xpt-tooltip.open').forEach(el => {
            if (el.id !== id) el.classList.remove('open');
        });
    }
}

document.addEventListener('click', e => {
    if (!e.target.closest('.xpt-tooltip-wrap')) {
        document.querySelectorAll('.xpt-tooltip.open').forEach(el => el.classList.remove('open'));
    }
}, true);
// ── STATISTICS & ANALYTICS ───────────────────────────────
// Depends on: common.js, data.js

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
    `;
}


// ── STATS SHORTCUTS ───────────────────────────────────────
function buildStatsShortcuts() {
    const shortcuts = [
        { id: 'stats-driver-section',      icon: 'bi-person',    label: 'DRIVER_STATS' },
        { id: 'stats-constructor-section', icon: 'bi-car-front', label: 'CONSTRUCTOR_STATS' },
        { id: 'stats-player-section',      icon: 'bi-people',    label: 'PLAYER_STATS' },
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
                    <i class="bi ${s.icon}"></i>
                    <span>${s.label}</span>
                </button>`).join('')}
        </div>`;
}

// ── SEASON RECORDS ────────────────────────────────────────
function buildSeasonRecords(players, rounds) {
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

    // most round wins
    const winsSorted   = [...players].sort((a, b) => b.wins - a.wins);
    const mostWinsVal  = winsSorted[0].wins;
    const mostWinners  = players.filter(p => p.wins === mostWinsVal);

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

    // budget gain
    const budgetSorted = players.map(p => {
        const allD = [p.team.captain, ...p.team.drivers];
        const gain = allD.reduce((s, d) => s + ((latestPrice(d,'drivers') ?? REG.drivers[d]?.init_price ?? 0) - (REG.drivers[d]?.init_price ?? 0)), 0)
                   + p.team.constructors.reduce((s, c) => s + ((latestPrice(c,'constructors') ?? REG.constructors[c]?.init_price ?? 0) - (REG.constructors[c]?.init_price ?? 0)), 0);
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
    return new Set([p.team.captain, ...p.team.drivers]);
}

function getPlayerConstructorCodes(playerCode) {
    if (!playerCode) return null;
    const p = league().players.find(x => x.code === playerCode);
    if (!p) return null;
    return new Set(p.team.constructors);
}

// ── DRIVER STATS ──────────────────────────────────────────
function buildDriverStats(rounds) {
    const allPlayers   = league().players;
    const totalPlayers = allPlayers.length || 1;

    let drivers = Object.entries(REG.drivers).map(([code, info]) => {
        let totalPts = 0, totalExp = 0, count = 0, bestP = -Infinity, worstP = Infinity, bestR = null, worstR = null;
        rounds.forEach(r => {
            const d = RESULTS[r.id]?.drivers?.[code]; if (!d) return;
            const p = d.pts ?? 0;
            totalPts += p; totalExp += d.exp ?? 0; count++;
            if (isRoundComplete(r)) {
                if (p > bestP)  { bestP = p;  bestR = r; }
                if (p < worstP) { worstP = p; worstR = r; }
            }
        });
        if (!count) return null;
        const initP    = info.init_price;
        const currP    = latestPrice(code, 'drivers') ?? initP;
        const avgPts   = totalPts / count;
        const acc      = totalExp !== 0 ? Math.max(0, 100 - Math.abs(totalPts - totalExp) / Math.abs(totalExp) * 100) : 0;
        const selCount = allPlayers.filter(p =>
            p.team.captain === code || p.team.drivers.includes(code)
        ).length;
        return { code, name: info.name, con: info.constructor.toLowerCase(),
            totalPts, totalExp, initP, currP, priceDiff: currP - initP,
            avgPts, ptsPerM: currP > 0 ? totalPts / currP : 0, acc, bestP, worstP, bestR, worstR, selCount, totalPlayers };
    }).filter(Boolean).sort((a, b) => b.totalPts - a.totalPts);

    const allowedCodes = getPlayerDriverCodes(statsPlayerFilter);
    if (allowedCodes) drivers = drivers.filter(d => allowedCodes.has(d.code));

    const inner = drivers.length
        ? `<div class="stat-table">${drivers.map((d, i) => buildStatCardRow(
            i+1, `var(--${d.con})`, d.code, d.name, d.totalPts, d.avgPts, d.ptsPerM, d.priceDiff,
            d.acc, d.totalExp, d.bestP, d.worstP, d.bestR, d.worstR, i===0, d.initP, d.currP, d.selCount, d.totalPlayers
          )).join('')}</div>`
        : `<div class="stat-table b"><div class="stats-empty label">NO_DATA FOR SELECTED PLAYER</div></div>`;

    return `<div id="stats-driver-section">
        <div class="label mb-2"><i class="bi bi-person me-2"></i>DRIVER_STATS</div>
        ${inner}
    </div>`;
}

// ── CONSTRUCTOR STATS ─────────────────────────────────────
function buildConstructorStats(rounds) {
    const allPlayers2   = league().players;
    const totalPlayers2 = allPlayers2.length || 1;
    const conPicks = {};
    allPlayers2.forEach(p => {
        p.team.constructors.forEach(c => { conPicks[c] = (conPicks[c] ?? 0) + 1; });
    });

    let constructors = Object.entries(REG.constructors).map(([code, info]) => {
        let totalPts = 0, totalExp = 0, count = 0, bestP = -Infinity, worstP = Infinity, bestR = null, worstR = null;
        rounds.forEach(r => {
            const c = RESULTS[r.id]?.constructors?.[code]; if (!c) return;
            const p = c.pts ?? 0;
            totalPts += p; totalExp += c.exp ?? 0; count++;
            if (isRoundComplete(r)) {
                if (p > bestP)  { bestP = p;  bestR = r; }
                if (p < worstP) { worstP = p; worstR = r; }
            }
        });
        if (!count) return null;
        const initP = info.init_price, currP = latestPrice(code,'constructors') ?? initP;
        const avgPts = totalPts / count;
        const acc    = totalExp !== 0 ? Math.max(0, 100 - Math.abs(totalPts - totalExp) / Math.abs(totalExp) * 100) : 0;
        const selCount = conPicks[code] ?? 0;
        return { code, name: info.name, totalPts, totalExp, initP, currP, priceDiff: currP - initP,
            avgPts, ptsPerM: currP > 0 ? totalPts / currP : 0, acc, bestP, worstP, bestR, worstR, selCount };
    }).filter(Boolean).sort((a, b) => b.totalPts - a.totalPts);

    const allowedCodes = getPlayerConstructorCodes(statsPlayerFilter);
    if (allowedCodes) constructors = constructors.filter(c => allowedCodes.has(c.code));

    const inner = constructors.length
        ? `<div class="stat-table">${constructors.map((c, i) => buildStatCardRow(
            i+1, `var(--${c.code.toLowerCase()})`, c.code, c.name, c.totalPts, c.avgPts, c.ptsPerM, c.priceDiff,
            c.acc, c.totalExp, c.bestP, c.worstP, c.bestR, c.worstR, i===0, c.initP, c.currP, c.selCount, null
          )).join('')}</div>`
        : `<div class="stat-table b"><div class="stats-empty label">NO_DATA FOR SELECTED PLAYER</div></div>`;

    return `<div id="stats-constructor-section">
        <div class="label mt-4 mb-2"><i class="bi bi-car-front me-2"></i>CONSTRUCTOR_STATS</div>
        ${inner}
    </div>`;
}


// ── PLAYER STATS ──────────────────────────────────────────
function buildPlayerStats(rounds) {
    const allPlayers   = league().players;

    let players = allPlayers.map(p => {
        let totalPts = 0, totalExp = 0, count = 0, bestP = -Infinity, worstP = Infinity, bestR = null, worstR = null;
        rounds.forEach(r => {
            const rd = p.rounds[r.id]; if (!rd) return;
            const pts = rd.pts ?? 0;
            totalPts += pts; totalExp += rd.exp ?? 0; count++;
            if (isRoundComplete(r)) {
                if (pts > bestP)  { bestP = pts;  bestR = r; }
                if (pts < worstP) { worstP = pts; worstR = r; }
            }
        });
        if (!count) return null;
        const avgPts = totalPts / count;
        const acc    = totalExp !== 0 ? Math.max(0, 100 - Math.abs(totalPts - totalExp) / Math.abs(totalExp) * 100) : 0;
        return { code: p.code, name: p.name, totalPts, totalExp, avgPts, acc,
                 bestP, worstP, bestR, worstR, wins: p.wins,
                 budgetInit: p.budgetInit, budgetCurr: p.budgetCurr };
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
                                <div class="sv fw-bold${ptsC ? ' '+ptsC : ''}">${p.totalPts}</div>
                            </div>
                        </div>
                    </div>
                    <div class="stat-secondary">
                        <div class="stat-sec-row">
                            ${sc('AVG_PTS/RND', p.avgPts.toFixed(1), p.avgPts < 0 ? 'neg' : '')}
                            ${sc('WINS', p.wins, p.wins === 0 ? 'muted' : 'warn')}
                            ${sc('GAP', gap === 0 ? '<span class="pos gap-leader">LEADER</span>' : gap, gap < 0 ? 'neg' : 'muted')}                        </div>
                        <div class="stat-sec-row">
                            ${roundTooltipCell('HIGHEST_PTS', p.bestP, p.bestR, `${uid}-best`, p.bestP < 0 ? 'neg' : '')}
                            ${roundTooltipCell('LOWEST_PTS',  p.worstP, p.worstR, `${uid}-worst`, p.worstP < 0 ? 'neg' : '')}
                            ${accCell}
                        </div>
                        <div class="stat-sec-row">
                            ${sc('INIT_BUDGET', p.budgetInit.toFixed(1)+'M')}
                            ${sc('CURR_BUDGET', p.budgetCurr.toFixed(1)+'M')}
                            ${sc('DIFF_BUDGET', diffHtml(p.budgetCurr - p.budgetInit, false))}
                        </div>
                    </div>
                </div>`;
          }).join('')}</div>`
        : `<div class="stat-table b"><div class="stats-empty label">NO_DATA FOR SELECTED PLAYER</div></div>`;

    return `<div id="stats-player-section">
        <div class="label mt-4 mb-2"><i class="bi bi-people me-2"></i>PLAYER_STATS</div>
        ${inner}
    </div>`;
}

// ── SHARED ROW BUILDER ────────────────────────────────────
function buildStatCardRow(rank, tagColor, code, name, totalPts, avgPts, ptsPerM, priceDiff, acc, totalExp, bestP, worstP, bestR, worstR, isTop, initP, currP, selCount = null, totalPlayers = null) {
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
            <div class="stat-secondary">
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
            </div>
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
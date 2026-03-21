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
        ${buildDriverStats(doneRounds)}
        ${buildConstructorStats(doneRounds)}
    `;
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

    // win streaks
    const streaksSorted = players.map(p => {
        let max = 0, cur = 0;
        rounds.forEach(r => {
            const roundPts = players.map(pp => pp.rounds[r.id]?.pts ?? -Infinity);
            const myPts    = p.rounds[r.id]?.pts ?? -Infinity;
            cur = myPts === Math.max(...roundPts) && myPts > -Infinity ? cur + 1 : 0;
            max = Math.max(max, cur);
        });
        return { p, streak: max };
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

    // items: subs = array of { code, extra } — supports multiple tied players
    const items = [
        { icon:'bi-trophy warn',           label:'MOST_WINS',
          val:`${mostWinsVal}`,             unit: mostWinsVal !== 1 ? 'WINS' : 'WIN',
          subs: mostWinners.map(p => ({ code: p.code, extra: null })) },

        { icon:'bi-fire warn',             label:'BEST_WIN_STREAK',
          val:`${bestStreakVal}`,            unit: bestStreakVal !== 1 ? 'ROUNDS' : 'ROUND',
          subs: bestStreakers.map(x => ({ code: x.p.code, extra: null })) },

        { icon:'bi-arrow-up-circle pos',   label:'BEST_ROUND',
          val:`${bestPts}`,                 unit:'PTS',
          subs: bestRounds.map(x => ({ code: x.p.code, extra: `R${pad(x.r.n)} ${fi(x.r.cc)}` })) },

        { icon:'bi-arrow-down-circle neg', label:'WORST_ROUND',
          val:`${worstPts}`,                unit:'PTS',
          subs: worstRounds.map(x => ({ code: x.p.code, extra: `R${pad(x.r.n)} ${fi(x.r.cc)}` })) },

        { icon:'bi-bar-chart-line pos',    label:'HIGHEST_AVG',
          val: highAvgVal.toFixed(1),       unit:'PTS',
          subs: highAvgs.map(x => ({ code: x.p.code, extra: null })) },

        { icon:'bi-bar-chart-line neg',    label:'LOWEST_AVG',
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
        const subTags = subs.map(({ code, extra }) =>
            `<span class="rec-sub-row">
                <span class="rec-sub"><span class="fw-bold">${code}</span></span>${extra ? `<span class="rec-sub-extra muted">${extra}</span>` : ''}
            </span>`
        ).join('');
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
        let totalPts = 0, totalExp = 0, count = 0, bestP = -Infinity, worstP = Infinity;
        rounds.forEach(r => {
            const d = RESULTS[r.id]?.drivers?.[code]; if (!d) return;
            const p = d.pts ?? 0;
            totalPts += p; totalExp += d.exp ?? 0; count++;
            if (p > bestP) bestP = p;
            if (p < worstP) worstP = p;
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
            totalPts, initP, currP, priceDiff: currP - initP,
            avgPts, ptsPerM: currP > 0 ? totalPts / currP : 0, acc, bestP, worstP, selCount, totalPlayers };
    }).filter(Boolean).sort((a, b) => b.totalPts - a.totalPts);

    const allowedCodes = getPlayerDriverCodes(statsPlayerFilter);
    if (allowedCodes) drivers = drivers.filter(d => allowedCodes.has(d.code));

    const inner = drivers.length
        ? `<div class="stat-table">${drivers.map((d, i) => buildStatCardRow(
            i+1, `var(--${d.con})`, d.code, d.name, d.totalPts, d.avgPts, d.ptsPerM, d.priceDiff,
            d.acc, d.bestP, d.worstP, i===0, d.initP, d.currP, d.selCount, d.totalPlayers
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
        let totalPts = 0, totalExp = 0, count = 0, bestP = -Infinity, worstP = Infinity;
        rounds.forEach(r => {
            const c = RESULTS[r.id]?.constructors?.[code]; if (!c) return;
            const p = c.pts ?? 0;
            totalPts += p; totalExp += c.exp ?? 0; count++;
            if (p > bestP) bestP = p;
            if (p < worstP) worstP = p;
        });
        if (!count) return null;
        const initP = info.init_price, currP = latestPrice(code,'constructors') ?? initP;
        const avgPts = totalPts / count;
        const acc    = totalExp !== 0 ? Math.max(0, 100 - Math.abs(totalPts - totalExp) / Math.abs(totalExp) * 100) : 0;
        const selCount = conPicks[code] ?? 0;
        return { code, name: info.name, totalPts, initP, currP, priceDiff: currP - initP,
            avgPts, ptsPerM: currP > 0 ? totalPts / currP : 0, acc, bestP, worstP, selCount };
    }).filter(Boolean).sort((a, b) => b.totalPts - a.totalPts);

    const allowedCodes = getPlayerConstructorCodes(statsPlayerFilter);
    if (allowedCodes) constructors = constructors.filter(c => allowedCodes.has(c.code));

    const inner = constructors.length
        ? `<div class="stat-table">${constructors.map((c, i) => buildStatCardRow(
            i+1, `var(--${c.code.toLowerCase()})`, c.code, c.name, c.totalPts, c.avgPts, c.ptsPerM, c.priceDiff,
            c.acc, c.bestP, c.worstP, i===0, c.initP, c.currP, c.selCount, null
          )).join('')}</div>`
        : `<div class="stat-table b"><div class="stats-empty label">NO_DATA FOR SELECTED PLAYER</div></div>`;

    return `<div id="stats-constructor-section">
        <div class="label mt-4 mb-2"><i class="bi bi-car-front me-2"></i>CONSTRUCTOR_STATS</div>
        ${inner}
    </div>`;
}

// ── SHARED ROW BUILDER ────────────────────────────────────
function buildStatCardRow(rank, tagColor, code, name, totalPts, avgPts, ptsPerM, priceDiff, acc, bestP, worstP, isTop, initP, currP, selCount = null, totalPlayers = null) {
    const ptsC = isTop ? 'warn' : totalPts < 0 ? 'neg' : '';
    const sc   = (label, val, cls = '') =>
        `<div class="sc"><div class="sl">${label}</div><div class="sv${cls ? ' '+cls : ''}">${val}</div></div>`;

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
                    ${sc('AVG/RND', avgPts.toFixed(1), avgPts > 0 ? 'pos' : avgPts < 0 ? 'neg' : '')}
                    ${sc('PTS/M',   ptsPerM.toFixed(1), ptsPerM > 0 ? 'pos' : ptsPerM < 0 ? 'neg' : '')}
                    ${sc('ACC',     acc.toFixed(0)+'%', accClass(acc))}
                </div>
                <div class="stat-sec-row">
                    ${sc('SELECTED', selCount !== null ? (totalPlayers !== null ? selCount + '/' + totalPlayers : selCount) : '—', !selCount || selCount == 0 ? 'muted' : '')}
                    ${sc('BEST', bestP, bestP < 0 ? 'neg' : '')}
                    ${sc('WORST', worstP, worstP < 0 ? 'neg' : '')}
                </div>
                <div class="stat-sec-row">
                    ${sc('INIT_PRICE', initP.toFixed(1)+'M')}
                    ${sc('CURR_PRICE', currP.toFixed(1)+'M')}
                    ${sc('DIFF_PRICE', diffHtml(priceDiff, false))}
                </div>
            </div>
        </div>`;
}
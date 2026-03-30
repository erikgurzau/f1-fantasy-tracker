// ── BEST / WORST FANTASY TEAM FOR A ROUND ────────────────
let insightsUseInitPrice = false;

function buildTeamInsights(roundId, budget = 100, useInit = insightsUseInitPrice) {
    const rd = RESULTS[roundId];
    if (!rd) return '';
    const BUDGET = budget;

    const allDrivers = Object.entries(rd.drivers)
        .map(([code, d]) => ({
            code,
            pts:   d.pts ?? 0,
            price: useInit
                ? (REG.drivers[code]?.init_price ?? 0)
                : (latestPrice(code, 'drivers') ?? REG.drivers[code]?.init_price ?? 0),
            con:   REG.drivers[code]?.constructor?.toLowerCase() ?? 'cad'
        }));

    const allCons = Object.entries(rd.constructors)
        .map(([code, c]) => ({
            code,
            pts:   c.pts ?? 0,
            price: useInit
                ? (REG.constructors[code]?.init_price ?? 0)
                : (latestPrice(code, 'constructors') ?? REG.constructors[code]?.init_price ?? 0)
        }));

    function pickTeam(drvPool, conPool, minimize = false) {
        let bestScore = minimize ? Infinity : -Infinity;
        let finalTeam = null;

        // All constructor pairs
        for (let i = 0; i < conPool.length; i++) {
            for (let j = i + 1; j < conPool.length; j++) {
                const c1 = conPool[i], c2 = conPool[j];
                const conPrice = c1.price + c2.price;
                const conPts   = c1.pts + c2.pts;
                if (conPrice >= BUDGET) continue;

                const drvBudget = BUDGET - conPrice;

                findDrivers(drvPool, 0, 5, drvBudget, 0, 0, [], (drvSet, drvPts, drvSpent) => {
                    const captain = drvSet.reduce((prev, curr) =>
                        minimize ? (curr.pts < prev.pts ? curr : prev)
                                 : (curr.pts > prev.pts ? curr : prev)
                    );
                    const totalScore = conPts + drvPts + captain.pts; // captain bonus
                    if (minimize ? totalScore < bestScore : totalScore > bestScore) {
                        bestScore = totalScore;
                        finalTeam = {
                            drv:      [...drvSet],
                            cons:     [c1, c2],
                            captain,
                            totalPts: totalScore,
                            spent:    conPrice + drvSpent,
                        };
                    }
                });
            }
        }
        return finalTeam;
    }

    function findDrivers(pool, startIdx, need, remBudget, currentPts, currentSpent, currentSet, onFound) {
        if (need === 0) {
            onFound(currentSet, currentPts, currentSpent);
            return;
        }
        if (startIdx > pool.length - need) return;

        for (let i = startIdx; i < pool.length; i++) {
            const d = pool[i];
            if (d.price <= remBudget) {
                currentSet.push(d);
                findDrivers(pool, i + 1, need - 1, remBudget - d.price,
                            currentPts + d.pts, currentSpent + d.price, currentSet, onFound);
                currentSet.pop();
            }
        }
    }

    const best  = pickTeam(
        [...allDrivers].sort((a, b) => b.pts - a.pts),
        [...allCons].sort((a, b) => b.pts - a.pts),
        false
    );
    const worst = pickTeam(
        [...allDrivers].sort((a, b) => a.pts - b.pts),
        [...allCons].sort((a, b) => a.pts - b.pts),
        true
    );

    function teamCard(title, icon, iconClass, team) {
        const isWin = team.totalPts > 0;
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

        const round = REG.rounds.find(r => r.id === roundId);
        const cc    = round?.cc ?? 'un';
        const roundTag = round
            ? `<div class="s-player-name ps-4"><img src="https://flagcdn.com/w40/${cc}.png" width="16" height="11" class="flag-inline">${round.name.toUpperCase()}</div>`
            : '';
        return `
            <div class="card-db">
                <div class="card-header-row bb pb-2 mb-2">
                    <div class="card-header-left">
                        <div class="s-code"><i class="bi ${icon} ${iconClass} me-2"></i>${title}</div>
                        ${roundTag}
                    </div>
                    <div class="card-header-right">
                        <div class="card-pts ${isWin ? 'pos' : 'neg'}">${team.totalPts} PTS</div>
                        <div class="card-gap muted">${team.spent.toFixed(1)}M / ${BUDGET}M</div>
                    </div>
                </div>
                <div class="hub-row hub-row-hd"><div>DRIVER</div><div>PTS</div><div>PRICE</div></div>
                ${dRows}
                <div class="hub-row hub-row-hd hub-section-sep"><div>CONSTRUCTOR</div><div>PTS</div><div>PRICE</div></div>
                ${cRows}
            </div>`;
    }

    const minCost = [...allDrivers].sort((a, b) => a.price - b.price).slice(0, 5).reduce((s, d) => s + d.price, 0)
                  + [...allCons].sort((a, b) => a.price - b.price).slice(0, 2).reduce((s, c) => s + c.price, 0);
    const infeasible = minCost > BUDGET;

    return `
        <div class="label mb-2 mt-4"><i class="bi bi-stars me-2"></i>ROUND_INSIGHTS</div>
        <div class="insights-config-panel">
            <div class="insights-config-row">
                <span class="label col text-right"><i class="bi bi-cash me-2"></i>BUDGET</span>
                <div class="col text-right">
                    <input type="number" min="10" max="200" step="0.5" value="${BUDGET}"
                        class="budget-input"
                        onchange="refreshTeamInsights('${roundId}', +this.value)">
                    <span class="muted" style="font-size:.82rem">M</span>
                </div>
            </div>
            <div class="insights-config-sep"></div>
            <div class="insights-config-row">
                <span class="label col text-right"><i class="bi bi-tag me-2"></i>PRICE_MODE</span>
                <div class="col text-right">
                    <label class="insights-toggle-wrap">
                        <input type="checkbox" class="insights-toggle-cb" ${useInit ? 'checked' : ''}
                            onchange="toggleInsightsPrice('${roundId}')">
                        <span class="insights-toggle-track">
                            <span class="insights-toggle-thumb"></span>
                        </span>
                        <span class="insights-toggle-label">${useInit ? 'INIT' : 'CURR'}</span>
                    </label>
                </div>
            </div>
        </div>
        ${infeasible
            ? `<div class="card-db" style="border-color:var(--neg);color:var(--text-muted);font-size:.82rem">
                <i class="bi bi-exclamation-triangle neg me-2"></i>BUDGET_TOO_LOW — min required: ${minCost.toFixed(1)}M for 5 drivers + 2 constructors
               </div>`
            : (best  ? teamCard('BEST_TEAM',  'bi-arrow-up-circle',   'pos', best)  : '')
            + (worst ? teamCard('WORST_TEAM', 'bi-arrow-down-circle', 'neg', worst) : '')
        }`;
}

function refreshTeamInsights(roundId, budget) {
    const hub = document.getElementById('hub');
    if (!hub) return;
    const marker = hub.querySelector('[data-insights-id]');
    if (!marker) return;
    marker.outerHTML = `<div data-insights-id="${roundId}">${buildTeamInsights(roundId, budget)}</div>`;
}

function toggleInsightsPrice(roundId) {
    insightsUseInitPrice = !insightsUseInitPrice;
    const hub = document.getElementById('hub');
    if (!hub) return;
    const marker = hub.querySelector('[data-insights-id]');
    if (!marker) return;
    const budgetInput = marker.querySelector('.budget-input');
    const budget = budgetInput ? +budgetInput.value : 100;
    marker.outerHTML = `<div data-insights-id="${roundId}">${buildTeamInsights(roundId, budget)}</div>`;
}

// ── RACE HUB ──────────────────────────────────────────────
// Depends on: common.js, data.js

function allSessionsHtml(round, isCurrent = false) {
    const order = sessionOrder(round.fmt);
    const sess  = round.sessions ?? {};
    const now   = Date.now();
    return order.map(key => {
        const iso    = sess[key]; if (!iso) return '';
        const start  = new Date(iso).getTime();
        const dur    = SESSION_DURATION[key] ?? 120 * 60 * 1000;
        const isPast = start < now;
        const isLive = isPast && now < start + dur;

        const label    = SESSION_LABELS[key] ?? key.toUpperCase();
        const datePart = sessionDateLabel(iso).split(',')[0];
        const timePart = sessionDateLabel(iso).split(',')[1]?.trim() ?? '';
        const completed    = isCurrent && isPast && !isLive;

        return `
            <div class="banner-sess-label sess-row ${completed ? 'completed' : ''}" style="justify-content:center">
                <span class="sess-row-inner${completed ? ' completed' : ''}">
                    <span class="sess-name ${completed ? 'muted' : ''}">${label}</span>
                    <span class="sess-sep">//</span>
                    <span>
                        <i class="bi bi-calendar3 sess-meta-icon"></i>
                        <span class="sess-date ${completed ? 'muted' : ''}">${datePart}</span>
                    </span>
                    <span class="ms-2">
                        <i class="bi bi-clock sess-meta-icon"></i>
                        <span class="sess-time ${completed ? 'muted' : ''}">${timePart}</span>
                    </span>
                    ${isLive ? '<span class="sess-live-tag">LIVE</span>' : ''}
                </span>
            </div>`;
    }).join('');
}

function hubRoundHeader(round, status, hasSessions = true) {
    const cc      = round.cc ?? 'un';
    const flag    = `<img src="https://flagcdn.com/w40/${cc}.png" class="card-db-flag" alt="${round.name}">`;
    const spr     = sprintBadge(round.fmt, 'md');
    const label   = roundLabel(round, status);
    return `
        <div class="card-db text-center py-4">
            <div class="label mb-2">${label}${spr ? ' — ' + spr : ''}</div>
            <div class="hub-round-name">${flag}${round.name.toUpperCase()}</div>
            <div class="label hub-round-date">${round.date}</div>`;
}

function renderHub() {
    const round = REG.rounds.find(r => r.id === selectedRound);
    const hub   = document.getElementById('hub');
    if (!round) return;

    const status = getRoundStatus(round);

    // ── CANCELLED ──
    if (status === 'cancelled') {
        const cc   = round.cc ?? 'un';
        const flag = `<img src="https://flagcdn.com/w40/${cc}.png" class="card-db-flag" alt="${round.name}">`;
        hub.innerHTML = `
            <div class="card-db text-center py-4">
                <div class="label mb-2">${roundLabel(round, 'cancelled')}</div>
                <div class="hub-round-name">${flag}${round.name.toUpperCase()}</div>
                <div class="label hub-round-date">${round.date}</div>
                <div class="sess-cancelled-msg">
                    <i class="bi bi-x-circle me-2 align-middle"></i>NO_SESSIONS_SCHEDULED
                </div>
            </div>`;
        return;
    }

    // ── UPCOMING ──
    if (status === 'upcoming' || status === 'next') {
        hub.innerHTML = hubRoundHeader(round, status) + `
            ${allSessionsHtml(round)}
        </div>`;
        return;
    }

    // ── CURRENT (no data yet) ──
    const rd = RESULTS[round.id];
    if (!rd) {
        hub.innerHTML = hubRoundHeader(round, 'current') + `
            ${allSessionsHtml(round, true)}
        </div>`;
        return;
    }

    // ── COMPLETED / PARTIAL — show results ──
    const playersWithData = league().players
        .map(p => ({ p, rData: p.rounds[round.id] }))
        .sort((a, b) => (b.rData?.pts ?? -Infinity) - (a.rData?.pts ?? -Infinity));

    const maxPts   = playersWithData[0]?.rData?.pts ?? -Infinity;
    const totalPts = playersWithData.reduce((s, { rData }) => s + (rData?.pts ?? 0), 0);

    // Completed: show TOTAL_ROUND_PTS. Partial: show session schedule instead.
    const isCompleted = isRoundComplete(round);
    const roundHeader = hubRoundHeader(round, status, false)
        + (isCompleted
            ? `<div class="hub-total-pts label mt-2">
                   <span class="muted">TOTAL_ROUND_PTS</span>
                   <span class="fw-bold text-main">${totalPts}</span>
               </div>`
            : allSessionsHtml(round, true))
        + `</div>`;

    hub.innerHTML = roundHeader
        + `<div class="label mb-3"><i class="bi bi-flag me-2"></i>RACE_RESULTS</div>`
        + playersWithData.map(({ p, rData }) => buildPlayerCard(p, rData, maxPts)).join('')
        + `<div data-insights-id="${round.id}">${buildTeamInsights(round.id)}</div>`;
}

function buildPlayerCard(p, rData, maxPts) {
    if (!rData) {
        return `<div class="card-db"><span class="label">NO_DATA — ${p.name}</span></div>`;
    }

    const isWinner = rData.pts === maxPts && maxPts > -Infinity;
    const dRows    = buildDriverRows(p, rData);
    const cRows    = buildConstructorRows(p, rData);
    const acc      = rData.acc.toFixed(0);
    const diff     = (rData.pts - rData.exp).toFixed(1);

    const gapHtml = isWinner
        ? `<span class="pos">WINNER</span>`
        : `<span class="neg">${rData.pts - maxPts}</span>`;

    return `
        <div class="card-db${isWinner ? ' card-db--winner' : ''}">
            <div class="card-header-row bb pb-2 mb-2">
                <div class="card-header-left">
                    <div class="s-code">${p.code}</div>
                    <div class="s-player-name">${p.name}</div>
                </div>
                <div class="card-header-right">
                    <div class="card-pts${isWinner ? ' warn' : ''}">${rData.pts} PTS</div>
                    <div class="card-gap">${gapHtml}</div>
                </div>
            </div>
            ${dRows}${cRows}
            <div class="hub-row hub-row-hd bt mt-2 pt-2">
                <span class="muted">ACCURACY_XPT</span>
                <span class="muted text-right">PTS</span>
                <span class="muted text-right">XPT</span>
            </div>
            <div class="summary">
                <span class="muted row">
                    <b class="col ${accClass(+acc)}">${acc}%</b>
                    <span class="col-auto diff-inline ${+diff < 0 ? 'neg' : 'pos'}">${+diff > 0 ? '+' : ''}${diff}</span>
                </span>
                <span class="muted text-right detail-total-val"><b class="text-main">${rData.pts}</b></span>
                <span class="muted text-right detail-total-val"><b class="text-main">${rData.exp.toFixed(1)}</b></span>
            </div>
        </div>`;
}

function buildDriverRows(p, rData) {
    let rows = `<div class="hub-row hub-row-hd"><div>DRIVER</div><div>PTS</div><div>XPT</div></div>`;
    [p.team.captain, ...p.team.drivers].forEach(d => {
        const dd  = rData.drivers[d]; if (!dd) return;
        const con = REG.drivers[d]?.constructor?.toLowerCase() ?? 'cad';
        const pts = dd.isCap ? dd.pts * 2 : dd.pts;
        const exp = dd.isCap ? dd.exp * 2 : dd.exp;
        rows += `
            <div class="hub-row">
                <div class="driver-tag" style="border-color:var(--${con})">
                    ${d}${dd.isCap ? '<span class="x2">X2</span>' : ''}
                </div>
                <div class="${ptsClass(pts)}">${pts}</div>
                <div class="${ptsClass(exp)}">${exp.toFixed(1)}</div>
            </div>`;
    });
    return rows;
}

function buildConstructorRows(p, rData) {
    let rows = `<div class="hub-row hub-row-hd hub-section-sep"><div>CONSTRUCTOR</div><div>PTS</div><div>XPT</div></div>`;
    p.team.constructors.forEach(c => {
        const cd = rData.constructors[c]; if (!cd) return;
        rows += `
            <div class="hub-row">
                <div class="driver-tag" style="border-color:var(--${c.toLowerCase()})">${c}</div>
                <div class="${ptsClass(cd.pts)}">${cd.pts}</div>
                <div class="${ptsClass(cd.exp)}">${cd.exp.toFixed(1)}</div>
            </div>`;
    });
    return rows;
}
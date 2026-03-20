// ── RACE HUB ──────────────────────────────────────────────
// Depends on: common.js, data.js

function allSessionsHtml(round) {
    const order = sessionOrder(round.fmt);
    const sess  = round.sessions ?? {};
    const now   = Date.now();
    return order.map(key => {
        const iso = sess[key]; if (!iso) return '';
        const isPast     = new Date(iso).getTime() < now;
        const labelColor = isPast ? 'sess-past' : 'sess-future';
        return `
            <div class="banner-sess-label sess-row">
                <i class="bi bi-clock me-1 align-middle"></i>
                <span class="${labelColor}">${SESSION_LABELS[key] ?? key.toUpperCase()}</span>
                <span class="sess-label-date"> — ${sessionDateLabel(iso)}</span>
            </div>`;
    }).join('');
}

function hubRoundHeader(round, status, hasSessions = true) {
    const cc      = round.cc ?? 'un';
    const flag    = `<img src="https://flagcdn.com/w40/${cc}.png" class="card-db-flag" alt="${round.name}">`;
    const spr     = sprintBadge(round.fmt, 'md');
    const label   = roundLabel(round, status);
    const dateCls = hasSessions ? 'hub-round-date' : 'hub-round-date hub-round-date--no-sep';
    return `
        <div class="card-db text-center py-4">
            <div class="label mb-2">${label}${spr ? ' — ' + spr : ''}</div>
            <div class="hub-round-name">${flag}${round.name.toUpperCase()}</div>
            <div class="label ${dateCls}">${round.date}</div>`;
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
    if (status === 'upcoming') {
        hub.innerHTML = hubRoundHeader(round, 'upcoming') + `
            ${allSessionsHtml(round)}
        </div>`;
        return;
    }

    // ── CURRENT (no data yet) ──
    const rd = RESULTS[round.id];
    if (!rd) {
        hub.innerHTML = hubRoundHeader(round, 'current') + `
            ${allSessionsHtml(round)}
        </div>`;
        return;
    }

    // ── COMPLETED / PARTIAL — show results ──
    const roundHeader = hubRoundHeader(round, status, false) + `</div>`;

    const playersWithData = league().players
        .map(p => ({ p, rData: p.rounds[round.id] }))
        .sort((a, b) => (b.rData?.pts ?? -Infinity) - (a.rData?.pts ?? -Infinity));

    const maxPts = playersWithData[0]?.rData?.pts ?? -Infinity;

    hub.innerHTML = roundHeader
        + `<div class="label mb-3"><i class="bi bi-flag me-2"></i>RACE_RESULTS</div>`
        + playersWithData.map(({ p, rData }) => buildPlayerCard(p, rData, maxPts)).join('');
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
                <span class="muted">ACCURACY</span>
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
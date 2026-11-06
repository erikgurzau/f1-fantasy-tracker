// ── STANDINGS ─────────────────────────────────────────────
// Depends on: common.js, data.js

function renderStandings() {
    const players = league().players;
    const wrap    = document.getElementById('standings-wrap');

    // ── Compute previous-round rank ───────────────────────
    const doneRounds = REG.rounds.filter(r => RESULTS[r.id]);
    const prevRound  = doneRounds.length >= 2 ? doneRounds[doneRounds.length - 2] : null;
    const prevRankMap = {};
    if (prevRound) {
        const prevIdx = REG.rounds.indexOf(prevRound);
        const prevPts = players.map(p => ({
            code: p.code,
            pts: REG.rounds
                .filter((r, ri) => ri <= prevIdx && RESULTS[r.id])
                .reduce((s, r) => s + (p.rounds[r.id]?.pts ?? 0), 0)
        })).sort((a, b) => b.pts - a.pts);
        prevPts.forEach((x, i) => { prevRankMap[x.code] = i + 1; });
    }

    let html = `
        <div class="standings-header">
            <div class="label text-center">#</div>
            <div class="label">PLAYER</div>
            <div class="label text-right">PTS</div>
            <div class="label text-right">W</div>
            <div class="label text-right">GAP</div>
        </div>`;

    players.forEach((p, i) => {
        const isLeader = i === 0;
        const gapHtml  = isLeader
            ? `<span class="pos gap-leader">LEADER</span>`
            : `<span class="neg">${p.gap}</span>`;

        // Trend icon vs previous round ranking
        const prevRank = prevRankMap[p.code];
        let trendHtml = '';
        if (prevRank != null) {
            const delta = prevRank - p.rank; // positive = moved up
            if (delta > 0)      trendHtml = `<i class="bi bi-caret-up-fill s-trend pos"></i>`;
            else if (delta < 0) trendHtml = `<i class="bi bi-caret-down-fill s-trend neg"></i>`;
            else                trendHtml = '';
        }
        const rankClass = prevRankMap[p.code] == null ? '' : (prevRankMap[p.code] - p.rank > 0 ? ' pos' : prevRankMap[p.code] - p.rank < 0 ? ' neg' : '');

        const allDrivers = [p.team.captain, ...p.team.drivers];
        const dRows      = buildRosterRows(allDrivers, 'drivers', p);
        const cRows      = buildRosterRows(p.team.constructors, 'constructors', p);
        const transferRows = buildTransferRows(p);

        const driverNames      = activeRoster(allDrivers, p).join('+');
        const constructorNames = activeRoster(p.team.constructors, p).join('+');
        const copyRow = `
            <div class="detail-copy-row">
                <button class="price-toggle" data-copy="${driverNames.replace(/"/g, '&quot;')}" onclick="copyTeamClipboard(this)">
                    <span class="d-flex flex-column align-items-center lh-sm"><span><i class="bi bi-clipboard me-1"></i>COPY</span><span>DRIVERS</span></span>
                </button>
                <button class="price-toggle" data-copy="${constructorNames.replace(/"/g, '&quot;')}" onclick="copyTeamClipboard(this)">
                    <span class="d-flex flex-column align-items-center lh-sm"><span><i class="bi bi-clipboard me-1"></i>COPY</span><span>CONSTRUCTORS</span></span>
                </button>
            </div>`;

        const budgetDiff  = p.budgetCurr - p.budgetInit;
        const totalBlock  = `
            <div class="detail-total">
                <div class="detail-total-col detail-total-label">TOTAL</div>
                <div class="detail-total-col">
                    <div class="detail-total-val">${p.budgetInit.toFixed(1)}M</div>
                </div>
                <div class="detail-total-col">
                    <div class="detail-total-val detail-total-curr">
                        ${diffHtml(budgetDiff, true)}
                        <span>${p.budgetCurr.toFixed(1)}M</span>
                    </div>
                </div>
            </div>`;

        html += `
            <div class="standings-row">
                <div class="standings-main" onclick="toggleDetail('sd-${p.code}',this)">
                    <div class="s-rank-wrap">${trendHtml}<div class="s-rank${rankClass}">${p.rank}</div></div>
                    <div class="s-name">
                        <div class="s-name-inner">
                            <div class="s-code">${p.code}</div>
                            <div class="s-player-name">${p.name}</div>
                        </div>
                    </div>
                    <div class="s-pts${isLeader ? ' leader-pts' : ''}">${p.totalPts}</div>
                    <div class="s-wins">${p.wins}</div>
                    <div class="s-gap">${gapHtml}</div>
                    <i class="bi bi-chevron-down s-chevron ms-2"></i>
                </div>
                <div class="standings-detail" id="sd-${p.code}">
                    <div class="hub-row price-row hub-row-hd">
                        <div>DRIVER</div><div>INIT</div><div>CURR</div>
                    </div>
                    ${dRows}
                    <div class="hub-row price-row hub-row-hd detail-section-sep">
                        <div>CONSTRUCTOR</div><div>INIT</div><div>CURR</div>
                    </div>
                    ${cRows}
                    ${totalBlock}
                    ${transferRows}
                    ${copyRow}
                </div>
            </div>`;
    });

    wrap.innerHTML = html;
}

function buildTransferRows(p) {
    const moves = p.transfers?.filter(t => t.out) ?? [];
    if (!moves.length) return '';
    const tag = (code) => {
        const isDrv = !!REG.drivers[code];
        const con   = isDrv ? (REG.drivers[code].constructor ?? 'cad').toLowerCase() : code.toLowerCase();
        return `<div class="driver-tag" style="border-color:var(--${con})">${code}</div>`;
    };
    const rows = moves.map(t => {
        const rnd = REG.rounds.find(r => r.id === t.round);
        const rndHtml = rnd
            ? `<img src="https://flagcdn.com/w40/${rnd.cc ?? 'un'}.png" width="16" height="11" class="flag-inline me-1">R${rnd.n}`
            : '';
        return `
        <div class="hub-row price-row">
            <div class="d-flex align-items-center">${tag(t.out)}<i class="bi bi-arrow-down-short neg ms-1"></i><span class="neg diff-small">OUT</span></div>
            <div class="d-flex align-items-center justify-content-end">${tag(t.in)}<i class="bi bi-arrow-up-short pos ms-1"></i><span class="pos diff-small">IN</span></div>
            <div class="d-flex align-items-center justify-content-end">${rndHtml}</div>
        </div>`;
    }).join('');
    return `
        <div class="hub-row price-row hub-row-hd detail-section-sep">
            <div>TRANSFERS</div><div></div><div class="text-end">ROUND</div>
        </div>${rows}`;
}

// Roster after applying every transfer (same slot: out → in)
function activeRoster(codes, p) {
    return codes.map(c => {
        let cur = c;
        for (const t of p.transfers ?? []) if (t.out === cur && t.in) cur = t.in;
        return cur;
    });
}

// Price rows for a list of drivers/constructors. A transferred-out code gets a
// red OUT arrow; its replacement is listed right below it with a green IN arrow.
// Works whether `codes` is the original team (…OCO…) or already the post-transfer
// one (…CAM…): in both cases the OUT driver is shown followed by its replacement.
function buildRosterRows(codes, type, p) {
    const transfers = (p.transfers ?? []).filter(t => t.out && t.in);
    const seen = new Set();
    let html = '';

    // follow "in ← out" links back to the original driver of that slot
    const rootOf = code => {
        const guard = new Set();
        let c = code;
        for (;;) {
            const t = transfers.find(t => t.in === c);
            if (!t || guard.has(c)) return c;
            guard.add(c);
            c = t.out;
        }
    };
    const emit = (code, isIn) => {
        if (seen.has(code)) return;
        seen.add(code);
        const next = transfers.filter(t => t.out === code);
        html += buildPriceRow(code, type, code === p.team.captain, { isIn, isOut: next.length > 0 });
        next.forEach(t => emit(t.in, true));
    };
    codes.forEach(c => emit(rootOf(c), false));
    return html;
}

function buildPriceRow(code, type, isCap, flags = {}) {
    const reg   = type === 'drivers' ? REG.drivers[code] : REG.constructors[code];
    if (!reg) return '';
    const con   = type === 'drivers' ? reg.constructor.toLowerCase() : code.toLowerCase();
    const initP = reg.init_price ?? 0;
    const currP = latestPrice(code, type) ?? initP;
    const diff  = currP - initP;
    const arrows = (flags.isIn  ? '<i class="bi bi-arrow-up-short pos ms-1"></i><span class="pos diff-small">IN</span>'    : '')
                 + (flags.isOut ? '<i class="bi bi-arrow-down-short neg ms-1"></i><span class="neg diff-small">OUT</span>' : '');
    return `
        <div class="hub-row price-row">
            <div class="driver-tag" style="border-color:var(--${con})">
                ${code}${isCap ? '<span class="x2">X2</span>' : ''}${arrows}
            </div>
            <div>${initP.toFixed(1)}M</div>
            <div class="price-curr-cell">
                ${diffHtml(diff, true)}
                <span>${currP.toFixed(1)}M</span>
            </div>
        </div>`;
}

function copyTeamClipboard(btn) {
    const text = btn.dataset.copy;
    if (!text) return;

    const showCopied = () => {
        if (btn._copyTimeout) clearTimeout(btn._copyTimeout);
        const original = btn.innerHTML;
        btn.classList.add('price-toggle--active');
        btn.innerHTML = `<i class="bi bi-check2 me-1"></i>COPIED`;
        btn._copyTimeout = setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('price-toggle--active');
        }, 1500);
    };

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(showCopied).catch(() => fallbackCopy(text, showCopied));
    } else {
        fallbackCopy(text, showCopied);
    }
}

function fallbackCopy(text, onDone) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); onDone(); } catch (e) { /* clipboard unavailable */ }
    document.body.removeChild(ta);
}

function toggleDetail(id, rowEl) {
    const detail  = document.getElementById(id);
    const chevron = rowEl.querySelector('.s-chevron');
    const isOpen  = detail.classList.toggle('open');
    chevron?.classList.toggle('open', isOpen);
}
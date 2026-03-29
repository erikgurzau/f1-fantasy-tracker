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
        const dRows      = allDrivers.map(d => buildPriceRow(d, 'drivers', d === p.team.captain)).join('');
        const cRows      = p.team.constructors.map(c => buildPriceRow(c, 'constructors', false)).join('');

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
            <div class="standings-row${isLeader ? ' leader-row' : ''}">
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
                </div>
            </div>`;
    });

    wrap.innerHTML = html;
}

function buildPriceRow(code, type, isCap) {
    const reg   = type === 'drivers' ? REG.drivers[code] : REG.constructors[code];
    if (!reg) return '';
    const con   = type === 'drivers' ? reg.constructor.toLowerCase() : code.toLowerCase();
    const initP = reg.init_price ?? 0;
    const currP = latestPrice(code, type) ?? initP;
    const diff  = currP - initP;
    return `
        <div class="hub-row price-row">
            <div class="driver-tag" style="border-color:var(--${con})">
                ${code}${isCap ? '<span class="x2">X2</span>' : ''}
            </div>
            <div>${initP.toFixed(1)}M</div>
            <div class="price-curr-cell">
                ${diffHtml(diff, true)}
                <span>${currP.toFixed(1)}M</span>
            </div>
        </div>`;
}

function toggleDetail(id, rowEl) {
    const detail  = document.getElementById(id);
    const chevron = rowEl.querySelector('.s-chevron');
    const isOpen  = detail.classList.toggle('open');
    chevron?.classList.toggle('open', isOpen);
}
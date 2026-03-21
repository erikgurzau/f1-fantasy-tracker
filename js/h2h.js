// ── HEAD-TO-HEAD ──────────────────────────────────────────
// Depends on: common.js, data.js

let h2hPlayerA = null;
let h2hPlayerB = null;

function renderH2H() {
    const wrap = document.getElementById('h2h-wrap');
    if (!wrap) return;
    const players = league().players;
    if (players.length < 2) {
        wrap.innerHTML = `<div class="stats-empty label">NEED AT LEAST 2 PLAYERS</div>`;
        return;
    }

    // Default selection
    if (!h2hPlayerA) h2hPlayerA = players[0].code;
    if (!h2hPlayerB) h2hPlayerB = players[1].code;

    const pA = players.find(p => p.code === h2hPlayerA);
    const pB = players.find(p => p.code === h2hPlayerB);

    const doneRounds = REG.rounds.filter(r => isRoundComplete(r) || isRoundPartial(r));

    wrap.innerHTML = `
        ${buildH2HSelector(players)}
        ${pA && pB ? buildH2HContent(pA, pB, doneRounds) : ''}
    `;
}

function buildH2HSelector(players) {
    function dropdownOpts(list, selectedCode, slot) {
        return list.map(p => `
            <div class="h2h-opt${p.code === selectedCode ? ' h2h-opt--active' : ''}"
                 onclick="setH2HPlayer('${slot}','${p.code}');closeH2HDropdown()">
                <span>${p.code}</span>
                <span class="h2h-opt-name muted">${p.name}</span>
            </div>`).join('');
    }

    const listA = players.filter(p => p.code !== h2hPlayerB);
    const listB = players.filter(p => p.code !== h2hPlayerA);
    const pA    = players.find(p => p.code === h2hPlayerA);
    const pB    = players.find(p => p.code === h2hPlayerB);

    return `
        <div class="h2h-selector">
            <div class="h2h-selector-player">
                <div class="label mb-1 accent">PLAYER A</div>
                <div class="h2h-dropdown" id="h2h-dd-a">
                    <button class="h2h-dd-btn" onclick="toggleH2HDropdown('h2h-dd-a')">
                        <span>${pA ? pA.code : '—'}</span>
                        <span class="h2h-opt-name muted">${pA ? pA.name : ''}</span>
                        <i class="bi bi-chevron-down h2h-dd-chevron"></i>
                    </button>
                    <div class="h2h-dd-list">${dropdownOpts(listA, h2hPlayerA, 'A')}</div>
                </div>
            </div>
            <div class="h2h-vs pt-4">VS</div>
            <div class="h2h-selector-player">
                <div class="label mb-1 warn">PLAYER B</div>
                <div class="h2h-dropdown" id="h2h-dd-b">
                    <button class="h2h-dd-btn" onclick="toggleH2HDropdown('h2h-dd-b')">
                        <span>${pB ? pB.code : '—'}</span>
                        <span class="h2h-opt-name muted">${pB ? pB.name : ''}</span>
                        <i class="bi bi-chevron-down h2h-dd-chevron"></i>
                    </button>
                    <div class="h2h-dd-list">${dropdownOpts(listB, h2hPlayerB, 'B')}</div>
                </div>
            </div>
        </div>`;
}

function toggleH2HDropdown(id) {
    document.querySelectorAll('.h2h-dropdown').forEach(d => {
        if (d.id !== id) d.classList.remove('open');
    });
    document.getElementById(id)?.classList.toggle('open');
}

function closeH2HDropdown() {
    document.querySelectorAll('.h2h-dropdown').forEach(d => d.classList.remove('open'));
}

document.addEventListener('click', e => {
    if (!e.target.closest('.h2h-dropdown')) closeH2HDropdown();
}, true);

function setH2HPlayer(slot, code) {
    if (slot === 'A') h2hPlayerA = code;
    else              h2hPlayerB = code;
    renderH2H();
}

function buildH2HContent(pA, pB, rounds) {
    if (!rounds.length) {
        return `<div class="stats-empty label">NO DATA YET</div>`;
    }

    const COL_A = '#58a6ff';
    const COL_B = '#e3b341';

    let winsA = 0, winsB = 0, draws = 0;
    rounds.forEach(r => {
        const ptA = pA.rounds[r.id]?.pts ?? null;
        const ptB = pB.rounds[r.id]?.pts ?? null;
        if (ptA === null || ptB === null) return;
        if (ptA > ptB) winsA++;
        else if (ptB > ptA) winsB++;
        else draws++;
    });

    return `
        ${buildH2HScoreboard(pA, pB, winsA, winsB, draws, COL_A, COL_B)}
        ${buildH2HCumulativeChart(pA, pB, rounds, COL_A, COL_B)}
        ${buildH2HGapChart(pA, pB, rounds, COL_A, COL_B)}
        ${buildH2HRoundTable(pA, pB, rounds, COL_A, COL_B)}
    `;
}

// ── Scoreboard banner ────────────────────────────────────
function buildH2HScoreboard(pA, pB, winsA, winsB, draws, colA, colB) {
    const leader    = winsA > winsB ? pA : winsB > winsA ? pB : null;
    const leaderCol = winsA > winsB ? colA : colB;
    const total     = winsA + winsB + draws || 1;

    return `
        <div class="label mb-2"><i class="bi bi-people me-2"></i>HEAD_TO_HEAD</div>
        <div class="stats-card h2h-scoreboard">
            <div class="h2h-score-side">
                <div class="h2h-score-code" style="color:${colA}">${pA.code}</div>
                <div class="h2h-score-num" style="color:${colA}">${winsA}</div>
            </div>
            <div class="h2h-score-center">
                <div class="h2h-score-draws">${draws} DRAW${draws !== 1 ? 'S' : ''}</div>
                <div class="h2h-score-bar">
                    <div class="h2h-bar-a" style="width:${(winsA/total*100).toFixed(1)}%;background:${colA}"></div>
                    <div class="h2h-bar-b" style="width:${(winsB/total*100).toFixed(1)}%;background:${colB}"></div>
                </div>
                ${leader ? `<div class="label mt-2" style="color:${leaderCol}">${leader.code} LEADS</div>` : `<div class="label mt-2">TIED</div>`}
            </div>
            <div class="h2h-score-side h2h-score-side--right">
                <div class="h2h-score-code" style="color:${colB}">${pB.code}</div>
                <div class="h2h-score-num" style="color:${colB}">${winsB}</div>
            </div>
        </div>`;
}

// ── Cumulative chart ─────────────────────────────────────
function buildH2HCumulativeChart(pA, pB, rounds, colA, colB) {
    const MIN_STEP = 14; // px minimum between two data points
    const W = Math.max(480, (rounds.length - 1) * MIN_STEP + 80), H = 240;

    let cumA = 0, cumB = 0;
    const seriesA = rounds.map(r => { cumA += pA.rounds[r.id]?.pts ?? 0; return cumA; });
    const seriesB = rounds.map(r => { cumB += pB.rounds[r.id]?.pts ?? 0; return cumB; });

    const all  = [...seriesA, ...seriesB];
    const maxV = Math.max(...all, 1);
    const minV = Math.min(...all, 0);
    const rng  = maxV - minV || 1;
    const n    = rounds.length;

    // compute left padding from widest y-tick label (7px per char at font-size 13)
    const yTicks = 4;
    const tickVals = Array.from({length: yTicks+1}, (_, i) => Math.round(minV + (rng/yTicks)*i));
    const maxLabelLen = Math.max(...tickVals.map(v => String(v).length));
    const PAD = { t: 20, r: maxLabelLen * 7, b: 52, l: maxLabelLen * 7 + 15 };

    const chartW = W - PAD.l - PAD.r;
    const chartH = H - PAD.t - PAD.b;

    const xS = i => PAD.l + (i / Math.max(n - 1, 1)) * chartW;
    const yS = v => PAD.t + chartH - ((v - minV) / rng) * chartH;

    const pathA = seriesA.map((v, i) => `${i===0?'M':'L'}${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(' ');
    const pathB = seriesB.map((v, i) => `${i===0?'M':'L'}${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(' ');

    const dotsA = seriesA.map((v, i) => `<circle cx="${xS(i).toFixed(1)}" cy="${yS(v).toFixed(1)}" r="3" fill="${colA}"/>`).join('');
    const dotsB = seriesB.map((v, i) => `<circle cx="${xS(i).toFixed(1)}" cy="${yS(v).toFixed(1)}" r="3" fill="${colB}"/>`).join('');

    const xLabels = rounds.map((r, i) => {
        const x = xS(i);
        const cc = r.cc ?? 'un';
        return `<image href="https://flagcdn.com/w40/${cc}.png" x="${(x - 10).toFixed(1)}" y="${H - PAD.b + 20}" width="13" height="9"/>
                <text x="${x.toFixed(1) - 4}" y="${H - 10}" fill="var(--text-muted)" font-size="8" text-anchor="middle">R${pad(r.n)}</text>`;
    }).join('');

    const grid = tickVals.map(v => {
        const y = yS(v);
        return `<line x1="${PAD.l}" y1="${y.toFixed(1)}" x2="${PAD.l+chartW}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>
                 <text x="${PAD.l-6}" y="${(y+4).toFixed(1)}" fill="var(--text-muted)" font-size="9" text-anchor="end">${v}</text>`;
    }).join('');

    return `
        <div class="label mb-2"><i class="bi bi-graph-up me-2"></i>CUMULATIVE_POINTS</div>
        <div class="stats-card chart-scroll">
            <svg viewBox="0 0 ${W} ${H}" class="stats-chart">
                ${grid}${xLabels}
                <path d="${pathA}" fill="none" stroke="${colA}" stroke-width="2"/>${dotsA}
                <path d="${pathB}" fill="none" stroke="${colB}" stroke-width="2"/>${dotsB}
            </svg>
        </div>`;
}

// ── Gap chart (A minus B per round) ─────────────────────
function buildH2HGapChart(pA, pB, rounds, colA, colB) {
    const MIN_STEP = 14; // px minimum per bar slot
    const H_PAD = 20; // horizontal padding each side
    const W = Math.max(480, rounds.length * MIN_STEP + H_PAD * 2), H = 200, PAD = { t: 20, r: H_PAD, b: 52, l: H_PAD };
    const chartW = W - PAD.l - PAD.r;
    const chartH = H - PAD.t - PAD.b;
 
    const gaps  = rounds.map(r => (pA.rounds[r.id]?.pts ?? 0) - (pB.rounds[r.id]?.pts ?? 0));
    const maxV  = Math.max(...gaps.map(Math.abs), 1);
    const barW  = Math.min(chartW / rounds.length - 4, 40);
 
    const xS = i => PAD.l + (i + 0.5) * (chartW / rounds.length);
    const yZero = PAD.t + chartH / 2;
    const yS = v => yZero - (v / maxV) * (chartH / 2);
 
    const bars = gaps.map((v, i) => {
        const x   = (xS(i) - barW/2).toFixed(1);
        const y   = Math.min(yS(v), yZero).toFixed(1);
        const h   = Math.abs(yS(v) - yZero);
        const col = v > 0 ? colA : v < 0 ? colB : 'var(--border)';
        return `<rect x="${x}" y="${y}" width="${barW.toFixed(1)}" height="${Math.max(h,1).toFixed(1)}" fill="${col}" opacity="0.8"/>`;
    }).join('');
 
    const zeroLine = `<line x1="${PAD.l}" y1="${yZero}" x2="${PAD.l+chartW}" y2="${yZero}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,3"/>`;
 
    const xLabels = rounds.map((r, i) => {
        const x = xS(i);
        const cc = r.cc ?? 'un';
        return `<image href="https://flagcdn.com/w40/${cc}.png" x="${(x - 6).toFixed(1)}" y="${H - PAD.b + 20}" width="13" height="9"/>
                <text x="${x.toFixed(1)}" y="${H - 10}" fill="var(--text-muted)" font-size="8" text-anchor="middle">R${pad(r.n)}</text>`;
    }).join('');
 
    return `
        <div class="label mb-2"><i class="bi bi-arrows-collapse me-2"></i>POINTS_GAP_PER_ROUND <span class="muted" style="font-size:.72rem;margin-left:.4rem">(+ ${pA.code} / − ${pB.code})</span></div>
        <div class="stats-card chart-scroll">
            <svg viewBox="0 0 ${W} ${H}" class="stats-chart">
                ${zeroLine}${bars}${xLabels}
            </svg>
        </div>`;
}

// ── Round-by-round table ─────────────────────────────────
function buildH2HRoundTable(pA, pB, rounds, colA, colB) {
    let cumA = 0, cumB = 0;
    const rows = rounds.map(r => {
        const ptA = pA.rounds[r.id]?.pts ?? null;
        const ptB = pB.rounds[r.id]?.pts ?? null;
        if (ptA !== null) cumA += ptA;
        if (ptB !== null) cumB += ptB;
        const winner = ptA !== null && ptB !== null ? (ptA > ptB ? 'A' : ptB > ptA ? 'B' : 'draw') : null;
        const roundGap = winner === 'draw' ? `<span class="muted">0</span>`
            : winner === 'A' ? `<span style="color:${colA}">+${ptA - ptB}</span>`
            : winner === 'B' ? `<span style="color:${colB}">+${ptB - ptA}</span>` : '<span class="muted">—</span>';
        const cumGap = cumA === cumB ? `<span class="muted">=</span>`
            : cumA > cumB ? `<span style="color:${colA}">+${cumA - cumB}</span>`
            : `<span style="color:${colB}">+${cumB - cumA}</span>`;
        const cc = r.cc ?? 'un';
        const bgClass = winner === 'A' ? 'h2h-row-win-a' : winner === 'B' ? 'h2h-row-win-b' : winner === 'draw' ? 'h2h-row-draw' : '';
        const ptAHtml = ptA !== null
            ? `<span class="${winner === 'A' ? 'fw-bold' : ''}" style="color:${winner === 'A' ? colA : 'var(--text-muted)'}">${ptA}</span>`
            : `<span class="muted">—</span>`;
        const ptBHtml = ptB !== null
            ? `<span class="${winner === 'B' ? 'fw-bold' : ''}" style="color:${winner === 'B' ? colB : 'var(--text-muted)'}">${ptB}</span>`
            : `<span class="muted">—</span>`;
        return `<div class="h2h-round-row ${bgClass}">
            <div class="h2h-rr-round">
                <img src="https://flagcdn.com/w40/${cc}.png" width="16" height="11" style="border:1px solid var(--border)">
                <span>R${pad(r.n)}</span>
            </div>
            <div class="h2h-rr-pts">${ptAHtml}</div>
            <div class="h2h-rr-pts">${ptBHtml}</div>
            <div class="h2h-rr-cum">
                <span style="color:${cumA >= cumB ? colA : 'var(--text-muted)'}">${cumA}</span>
                <span class="muted">–</span>
                <span style="color:${cumB >= cumA ? colB : 'var(--text-muted)'}">${cumB}</span>
            </div>
            <div class="h2h-rr-cum-gap">${cumGap}</div>
        </div>`;
    }).join('');

    return `
        <div class="label mb-2"><i class="bi bi-list-ol me-2"></i>ROUND_BY_ROUND</div>
        <div class="stats-card p-0">
            <div class="h2h-round-row h2h-round-hd">
                <div class="h2h-rr-round">RND</div>
                <div class="h2h-rr-pts" style="color:${colA}">${pA.code}</div>
                <div class="h2h-rr-pts" style="color:${colB}">${pB.code}</div>
                <div class="h2h-rr-cum">TOT</div>
                <div class="h2h-rr-cum-gap">GAP</div>
            </div>
            ${rows}
        </div>`;
}
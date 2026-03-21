// ── BANNER + CLOCK + STATUS ───────────────────────────────
// Depends on: common.js

function startClock() {
    function tick() {
        const now = new Date();
        const d   = now.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
        const t   = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const el  = document.getElementById('live-clock');
        if (el) el.textContent = d.toUpperCase() + ' ' + t;
        renderUpdatedStatus(now);
    }
    tick();
    setInterval(tick, 1000);
}

function renderUpdatedStatus(now) {
    const el = document.getElementById('updated-status');
    if (!el) return;

    const checkRound = (() => {
        if (!currentRound) return null;
        const sess  = currentRound.sessions ?? {};
        const order = sessionOrder(currentRound.fmt);
        const anyStarted = order.some(k => sess[k] && new Date(sess[k]) < now);
        if (anyStarted) return currentRound;
        return lastCompletedRound() ?? currentRound;
    })();

    if (!checkRound) {
        el.innerHTML = `STATUS_POINTS: <span class="status-unknown fw-bold">—</span>`;
        return;
    }

    const rd = RESULTS[checkRound.id];
    if (!rd) {
        el.innerHTML = `STATUS_POINTS: <span class="status-unknown fw-bold">—</span>`;
        return;
    }

    const status      = rd.status?.toLowerCase() ?? null;
    const updatedTo   = rd.updated_to
        ? (SESSION_LABELS[rd.updated_to.toLowerCase()] ?? rd.updated_to.toUpperCase())
        : null;
    const statusClass = status === 'updated' ? 'pos' : status === 'provisional' ? 'warn' : 'muted';
    const statusText  = status ? status.toUpperCase() : '—';
    const suffix      = updatedTo
        ? ` <span class="status-session">// ${updatedTo}_${checkRound.id}</span>`
        : '';

    el.innerHTML = `STATUS_POINTS: <span class="${statusClass} fw-bold">${statusText}</span>${suffix}`;
}

function renderBanner() {
    const total   = REG.rounds.length;
    const current = currentRound ? currentRound.n : REG.rounds.filter(r => isRoundComplete(r) || isRoundPartial(r)).length;
    const pct     = Math.round(current / total * 100);
    const last    = lastCompletedRound();
    const next    = currentRound;

    if (cdInterval) clearInterval(cdInterval);

    const lastBlock = `
        <div class="banner-last px-3 pb-3">
            <div class="label banner-section-label">LAST ROUND</div>
            <div class="banner-round-flag">
                ${last ? flagImg(last.cc, last.name) : ''}
                <span class="fw-bold">${last ? last.name.toUpperCase() : 'N/A'}</span>
            </div>
            ${last ? `<div class="banner-completed-tag"><i class="bi bi-check-circle me-1"></i>ROUND_${pad(last.n)}_COMPLETED</div>` : ''}
        </div>`;

    let nextBlock = '';
    // Check if all rounds are done — no next session to show
    const allRoundsDone = REG.rounds.every(r => isRoundComplete(r) || r.status === 'cancelled');
    if (next && !allRoundsDone) {
        const sess = nextSession(next);
        if (sess) {
            const cd    = formatCD(sess.ms);
            const now0  = new Date();
            const elapsed0 = now0 - new Date(sess.iso);
            const dur0  = SESSION_DURATION[sess.key] ?? 120 * 60 * 1000;
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
                <div class="banner-round-flag mb-2">
                    ${flagImg(next.cc, next.name)}
                    <span class="fw-bold">${next.name.toUpperCase()}</span>
                </div>
                <div class="banner-sess-label">
                    <i class="bi bi-clock me-1 align-middle"></i>
                    <span class="sess-label-name">${sess.label}</span>
                    <span class="sess-label-date">— ${sessionDateLabel(sess.iso)}</span>
                </div>
                <div class="cd-wrap" id="cd-wrap-live">${cdContent}</div>
            </div>`;

            cdInterval = setInterval(() => {
                const now2    = new Date();
                const rem     = new Date(sess.iso) - now2;
                const elapsed = now2 - new Date(sess.iso);
                const dur     = SESSION_DURATION[sess.key] ?? 120 * 60 * 1000;
                const cdWrap  = document.getElementById('cd-wrap-live');
                if (!cdWrap) return;
                if (rem > 0) {
                    const t = formatCD(rem);
                    ['d', 'h', 'm', 's'].forEach(k => {
                        const el = document.getElementById('cd-' + k);
                        if (el) el.textContent = t[k];
                    });
                } else if (elapsed < dur) {
                    cdWrap.innerHTML = `<div class="live-badge"><span class="live-dot"></span>LIVE</div>`;
                    clearInterval(cdInterval);
                } else {
                    clearInterval(cdInterval);
                    renderBanner();
                }
            }, 1000);
        }
    }

    document.getElementById('banner').innerHTML = `
        <div class="px-3 pt-3">
            <div class="label banner-section-label">SEASON_PROGRESS &nbsp;&mdash;&nbsp; R${pad(current)} / R${pad(total)}</div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        </div>
        ${lastBlock}${nextBlock}`;
}
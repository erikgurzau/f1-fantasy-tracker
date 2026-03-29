// ── BANNER + CLOCK + STATUS ───────────────────────────────
// Depends on: common.js

function startClock() {
    function tick() {
        const now = new Date();
        const d   = now.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
        const t   = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const el  = document.getElementById('live-clock');
        if (el) el.textContent = d.toUpperCase() + ' ' + t;
    }
    tick();
    setInterval(tick, 1000);
    renderUpdatedStatus(new Date()); // ← called once on load
}

// Sessions that trigger a switch to the current round's status.
// Before these start we still show the previous round's status.
const SCORING_SESSIONS = new Set(['sq', 'q', 'sr', 'r']);

function renderUpdatedStatus(now) {
    const el = document.getElementById('updated-status');
    if (!el) return;

    // First scoreable session key for a round (sprint_qualy or qualy)
    function firstScoringSession(r) {
        const order = sessionOrder(r.fmt);
        return order.find(k => SCORING_SESSIONS.has(k)) ?? 'q';
    }

    // Last scoring session that has already started (wall-clock), in calendar order.
    // Returns { key, iso } or null if none has started yet.
    function lastStartedScoringSession(r) {
        const order = sessionOrder(r.fmt);
        let last = null;
        for (const key of order) {
            if (!SCORING_SESSIONS.has(key)) continue;
            const iso = r.sessions?.[key];
            if (!iso) continue;
            if (new Date(iso) <= now) last = { key, iso };
        }
        return last;
    }

    // Has the first scoring session of the current round already started?
    function currentRoundScoringStarted(r) {
        const key = firstScoringSession(r);
        const iso = r.sessions?.[key];
        return iso ? new Date(iso) <= now : false;
    }

    // Decide which round to display status for
    let targetRound = null;
    let notUpdated  = false;

    if (!currentRound) {
        targetRound = lastCompletedRound();
    } else if (isRoundPartial(currentRound) || isRoundComplete(currentRound)) {
        targetRound = currentRound;
    } else if (currentRoundScoringStarted(currentRound)) {
        targetRound = currentRound;
        notUpdated  = true;
    } else {
        const prevWithData = (() => {
            let r = null;
            for (const round of REG.rounds) {
                if (round.id === currentRound.id) break;
                if (RESULTS[round.id]) r = round;
            }
            return r;
        })();
        targetRound = prevWithData ?? lastCompletedRound() ?? currentRound;
    }

    if (!targetRound) {
        el.innerHTML = `
            <div class="term-block">
                <div class="term-line text-lowercase">
                    <span class="term-prompt">$</span>
                    ./f1ft --status_points
                    <span class="term-muted">—</span>
                </div>
            </div>`;
        return;
    }

    const rd = RESULTS[targetRound.id];

    const calSession = lastStartedScoringSession(targetRound) ?? { key: firstScoringSession(targetRound) };
    const calKey     = calSession.key;
    const updatedKey = rd?.updated_to?.toLowerCase() ?? null;

    const order      = sessionOrder(targetRound.fmt);
    const calIdx     = order.indexOf(calKey);
    const updatedIdx = updatedKey ? order.indexOf(updatedKey) : -1;
    const isUpToDate = updatedIdx >= calIdx;

    let statusClass, statusText, sessionLabel, updatedToLabel;

    if (!rd || notUpdated || !isUpToDate) {
        statusClass    = 'term-neg';
        statusText     = 'NOT_UPDATED';
        sessionLabel   = (SESSION_LABELS[calKey] ?? calKey.toUpperCase()) + ' [' + targetRound.id.toUpperCase() + ']';
        updatedToLabel = null;
    } else {
        const status = rd.status?.toLowerCase() ?? null;
        statusClass    = status === 'updated' ? 'term-pos' : status === 'provisional' ? 'term-warn' : 'term-muted';
        statusText     = status ? status.toUpperCase() : '—';
        sessionLabel   = null;
        updatedToLabel = updatedKey
            ? (SESSION_LABELS[updatedKey] ?? updatedKey.toUpperCase()) + ' [' + targetRound.id.toUpperCase() + ']'
            : null;
    }

    // Build terminal lines — output inline with command, all wrapped in a bg box
    const sessionTarget = updatedToLabel ?? sessionLabel;
    const cmdLabel2     = updatedToLabel ? './f1ft --updated_to' : './f1ft --pending_session';

    let html = `<div class="term-block">`;

    html += `
        <div class="term-line">
            <span class="term-cmd text-lowercase"><span class="term-prompt">$ </span>./f1ft --status_points</span>
            <span class="${statusClass} term-val">${statusText}</span>
        </div>`;

    if (sessionTarget) {
        html += `
        <div class="term-line">
            <span class="term-cmd text-lowercase"><span class="term-prompt">$ </span>${cmdLabel2}</span>
            <span class="term-val">${sessionTarget}</span>
        </div>`;
    }

    html += `</div>`;
    el.innerHTML = html;
}

function renderBanner() {
    const total   = REG.rounds.length;
    const current = currentRound ? currentRound.n : REG.rounds.filter(r => isRoundComplete(r) || isRoundPartial(r)).length;
    const pct     = Math.round(current / total * 100);
    const lastWithData = (() => {
        let r = null;
        for (const round of REG.rounds) {
            if (RESULTS[round.id]) r = round;
        }
        return r;
    })();
    const last = lastWithData;
    const next = currentRound;

    if (cdInterval) clearInterval(cdInterval);

    const lastBlock = `
        <div class="banner-last px-3 pb-3">
            <div class="label banner-section-label">LAST_ROUND</div>
            <div class="banner-round-flag">
                ${last ? flagImg(last.cc, last.name) : ''}
                <span class="fw-bold">${last ? last.name.toUpperCase() : 'N/A'}</span>
            </div>
            ${last ? (() => {
                const isComplete = isRoundComplete(last);
                const icon = isComplete ? 'bi-check-circle' : 'bi-hourglass-split';
                const label = isComplete
                    ? `ROUND_${pad(last.n)}_COMPLETED`
                    : `ROUND_${pad(last.n)}_PARTIAL`;
                const cls = isComplete ? 'banner-completed-tag' : 'banner-completed-tag banner-partial-tag';
                return `<div class="${cls}"><i class="bi ${icon} me-1"></i>${label}</div>`;
            })() : ''}
        </div>`;

    let nextBlock = '';
    const allRoundsDone = REG.rounds.every(r => isRoundComplete(r) || r.status === 'cancelled');
    if (next && !allRoundsDone) {
        let displayRound = next;
        let sess = nextSession(displayRound);
        if (!sess) {
            const fallback = deriveNextRound(next);
            if (fallback) { displayRound = fallback; sess = nextSession(fallback); }
        }
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

            const isNext = displayRound !== next;
            nextBlock = `
            <div class="banner-sep"></div>
            <div class="p-3 ${isLiveNow ? 'live-banner-left' : 'banner-left'}">
                <div class="banner-next-label">${isNext ? 'NEXT_ROUND' : 'CURRENT_ROUND'}</div>
                <div class="banner-round-flag mb-2">
                    ${flagImg(displayRound.cc, displayRound.name)}
                    <span class="fw-bold">${displayRound.name.toUpperCase()}</span>
                </div>
                <div class="banner-sess-label">
                    <i class="bi bi-clock"></i>
                    <span class="sess-label-name">${sess.label} <span class="muted opacitiy-50">//</span> ${sessionDateLabel(sess.iso)}</span>
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
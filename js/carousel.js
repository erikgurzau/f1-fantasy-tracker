// ── CAROUSEL ──────────────────────────────────────────────
// Depends on: common.js

function renderCarousel() {
    const el     = document.getElementById('carousel');
    const dotMap = {
        completed: 'dot-completed',
        current:   'dot-current',
        upcoming:  'dot-upcoming',
        cancelled: 'dot-cancelled',
    };
    const stLabel = {
        completed: 'DONE',
        current:   'CURRENT',
        upcoming:  'UPCOMING',
        cancelled: 'CANCELLED',
    };

    el.innerHTML = REG.rounds.map(r => {
        const status  = getRoundStatus(r);
        const isSel   = r.id === selectedRound;
        const cc      = r.cc ?? 'un';
        const classes = [
            'race-card',
            status === 'completed' ? 'is-done'      : '',
            status === 'current'   ? 'is-current'   : '',
            status === 'cancelled' ? 'is-cancelled' : '',
            isSel                  ? 'active'       : '',
        ].filter(Boolean).join(' ');

        const overlay = status === 'completed'
            ? `<div class="rc-overlay-done"></div>`
            : status === 'cancelled'
            ? `<div class="rc-overlay-cancelled"></div>`
            : '';

        const statusLabel = (() => {
            if (status !== 'upcoming') return stLabel[status] ?? '';
            const firstUpcoming = REG.rounds.find(r => getRoundStatus(r) === 'upcoming');
            return (firstUpcoming && r.id === firstUpcoming.id) ? 'NEXT' : 'UPCOMING';
        })();

        return `
            <div class="${classes}" data-round-id="${r.id}" onclick="selectRace('${r.id}')">
                ${overlay}
                <div class="rc-round">
                    <div class="rc-round-left">
                        <span class="dot ${dotMap[status] ?? 'dot-upcoming'}"></span>
                        <span>R${pad(r.n)}</span>
                    </div>
                    ${r.fmt === 'spr' ? '<span class="rc-spr-badge">SPRINT</span>' : ''}
                </div>
                <div class="rc-flag">
                    <img src="https://flagcdn.com/w40/${cc}.png" alt="${r.name}" loading="lazy">
                </div>
                <div class="rc-name text-uppercase">${r.name}</div>
                <div class="rc-date">${r.date}</div>
                <div class="rc-status ${status}">${statusLabel}</div>
            </div>`;
    }).join('');

    setTimeout(() => {
        const active = el.querySelector('.active');
        if (active) {
            const center = active.offsetLeft - (el.clientWidth / 2) + (active.offsetWidth / 2);
            el.scrollLeft = Math.max(0, center);
        }
        setTimeout(syncScrubber, 100);
        setTimeout(updateCurrentBtn, 500);
    }, 60);

    if (!el._scrubListening) {
        el.addEventListener('scroll', () => { syncScrubber(); updateCurrentBtn(); }, { passive: true });
        el._scrubListening = true;
    }
}

function shiftCar(steps) {
    document.getElementById('carousel').scrollBy({ left: steps * 114, behavior: 'smooth' });
    setTimeout(syncScrubber, 300);
}

function syncScrubber() {
    const c     = document.getElementById('carousel');
    const fill  = document.getElementById('scrubber-fill');
    const thumb = document.getElementById('scrubber-thumb');
    if (!c || !fill || !thumb) return;
    const max = c.scrollWidth - c.clientWidth;
    const pct = max > 0 ? (c.scrollLeft / max) * 100 : 0;
    fill.style.width = pct + '%';
    thumb.style.left = pct + '%';
}

function scrubberClick(e) {
    const s = document.getElementById('scrubber');
    const c = document.getElementById('carousel');
    if (!s || !c) return;
    const rect = s.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    c.scrollLeft = pct * (c.scrollWidth - c.clientWidth);
    syncScrubber();
}

function selectRace(id) {
    selectedRound = id;
    renderCarousel();
    renderHub();
}

function updateCurrentBtn() {
    const btn  = document.getElementById('btn-goto-current');
    if (!btn || !currentRound) { if (btn) btn.style.display = 'none'; return; }
    const el   = document.getElementById('carousel');
    const card = el?.querySelector(`[data-round-id="${currentRound.id}"]`);
    if (!card) { btn.style.display = 'none'; return; }
    const cr = el.getBoundingClientRect();
    const cc = card.getBoundingClientRect();
    btn.style.display = (cc.left < cr.right && cc.right > cr.left) ? 'none' : 'inline-flex';
}

function goToCurrent() {
    if (!currentRound) return;
    selectRace(currentRound.id);
    const el   = document.getElementById('carousel');
    const card = el?.querySelector(`[data-round-id="${currentRound.id}"]`);
    if (card && el) {
        const center = card.offsetLeft - (el.clientWidth / 2) + (card.offsetWidth / 2);
        el.scrollTo({ left: Math.max(0, center), behavior: 'smooth' });
    }
}

// ── CHAMPION CARD ─────────────────────────────────────────
// Shown above the banner once every (non-cancelled) round is complete.
// Depends on: common.js, data.js

let championRaf = null;

function isSeasonOver() {
    const rounds = REG.rounds.filter(r => r.status !== 'cancelled');
    return rounds.length > 0 && rounds.every(r => isRoundComplete(r));
}

function renderChampion() {
    const el = document.getElementById('champion');
    if (!el) return;
    stopChampionConfetti();
    if (!isSeasonOver()) { el.innerHTML = ''; el.style.display = 'none'; return; }

    const champ = league().players[0];

    el.style.display = '';
    el.innerHTML = `
        <div class="champ-card">
            <canvas class="champ-confetti" id="champ-confetti"></canvas>
            <div class="px-3 pt-3"><div class="champ-label">SEASON_${REG.season} // CHAMPION</div></div>
            <div class="champ-head">
                <div class="champ-icon">#1</div>
                <div class="champ-id">
                    <div class="champ-code">${champ.code}</div>
                    <div class="champ-name">${champ.name}</div>
                </div>
            </div>
            <div class="champ-sep"></div>
            <div class="champ-stats">
                <div><div class="champ-label">PTS</div><div class="champ-stat-val">${champ.totalPts}</div></div>
                <div><div class="champ-label">WINS</div><div class="champ-stat-val">${champ.wins}</div></div>
                <div><div class="champ-label">TEAM_VALUE</div><div class="champ-stat-val">${champ.budgetCurr.toFixed(1)}M</div></div>
            </div>
        </div>`;

    startChampionConfetti(document.getElementById('champ-confetti'));
}
function stopChampionConfetti() {
    if (championRaf) cancelAnimationFrame(championRaf);
    championRaf = null;
}

function startChampionConfetti(canvas) {
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx    = canvas.getContext('2d');
    const colors = ['#e3b341', '#f0cd75', '#b8892a', '#e8e6e3'];
    let pieces = [];

    const resize = () => {
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    };
    resize();

    const spawn = (y) => ({
        x: Math.random() * canvas.width,
        y,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        vy: 0.8 + Math.random() * 1.6,
        vx: (Math.random() - 0.5) * 1.2,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.18,
        sway: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
    });

    // Initial burst from the top, then a steady drizzle
    for (let i = 0; i < 40; i++) pieces.push(spawn(-Math.random() * canvas.height));

    const frame = () => {
        if (!canvas.isConnected) { championRaf = null; return; }
        if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) resize();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        pieces.forEach((p, i) => {
            p.sway += 0.05;
            p.x += p.vx + Math.sin(p.sway) * 0.6;
            p.y += p.vy;
            p.rot += p.vr;
            if (p.y > canvas.height + 20) pieces[i] = spawn(-10);

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(1, Math.abs(Math.cos(p.sway)) * 0.8 + 0.2); // flip effect
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });
        championRaf = requestAnimationFrame(frame);
    };
    championRaf = requestAnimationFrame(frame);
}

// ── INIT ──────────────────────────────────────────────────
// Entry point — all logic lives in the other modules.

window.onload = async () => {
    await loadData();

    const key = new URLSearchParams(window.location.search).get('key');
    const lg  = key ? REG.championships.find(c => c.key === key) : null;

    if (!lg) {
        document.title = 'F1 FANTASY — NOT FOUND';
        document.body.innerHTML = `
            <div class="access-denied-wrap">
                <div class="access-denied-box">
                    <div class="label mb-2">F1_FANTASY_TRACKER // ${REG.season}</div>
                    <div class="access-denied-title">ACCESS DENIED</div>
                    <div class="access-denied-body">
                        ${key
                            ? `League <span class="fw-bold text-main">"${key}"</span> not found.`
                            : 'No league key provided.'}
                        <br>Use a valid <span class="accent">?key=</span> parameter in the URL.
                    </div>
                    <div class="access-denied-footer">
                        Contact the league admin for your access link.
                    </div>
                </div>
            </div>`;
        return;
    }

    activeKey    = key;
    currentRound = deriveCurrentRound();
    precompute();

    document.getElementById('app-subtitle').textContent = `F1_FANTASY_TRACKER // ${REG.season}`;
    document.getElementById('league-name').textContent  = lg.name;
    document.title = `${lg.name} // F1_FANTASY_TRACKER ${REG.season}`;

    selectedRound = currentRound?.id ?? REG.rounds[0].id;

    startClock();
    renderBanner();
    renderStandings();
    renderCarousel();
    renderHub();
};

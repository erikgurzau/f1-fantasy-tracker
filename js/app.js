// ── INIT ──────────────────────────────────────────────────
// Entry point — all logic lives in the other modules.

let activeTab = 'overview';
const tabRendered = { overview: false, stats: false, h2h: false };

function switchTab(name) {
    // Update buttons
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${name}'`));
    });
    // Update panes
    document.querySelectorAll('.nav-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `pane-${name}`);
    });
    activeTab = name;
    // Lazy render on first visit
    if (!tabRendered[name]) {
        tabRendered[name] = true;
        if (name === 'stats') renderStats();
        if (name === 'h2h')   renderH2H();
    }
}

window.onload = async () => {
    await bootRun(loadData());

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
    nextRound = deriveNextRound();
    precompute();

    document.getElementById('app-subtitle').textContent = `F1_FANTASY_TRACKER // ${REG.season}`;
    document.getElementById('league-name').textContent  = lg.name;
    document.title = `${lg.name} // F1FT ${REG.season}`;

    selectedRound = currentRound?.id ?? REG.rounds[0].id;
    tabRendered.overview = true;

    startClock();
    renderBanner();
    renderStandings();
    renderCarousel();
    renderHub();
};
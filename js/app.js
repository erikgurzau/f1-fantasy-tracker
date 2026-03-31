// ── INIT ──────────────────────────────────────────────────
// Entry point — all logic lives in the other modules.

let activeTab = 'overview';
const tabRendered = { overview: false, stats: false, h2h: false };

function switchTab(name) {
    if (activeTab === name) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${name}'`));
    });
    document.querySelectorAll('.nav-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `pane-${name}`);
    });
    activeTab = name;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!tabRendered[name]) {
        tabRendered[name] = true;
        if (name === 'stats') renderStats();
        if (name === 'h2h')   renderH2H();
    }
}

// ── ADMIN PICKER ──────────────────────────────────────────
function showAdminPicker(championships) {
    // Remove boot cover — admin screen replaces it
    const cover = document.getElementById('boot-cover');
    if (cover) cover.remove();

    let selected = championships[0]?.key ?? null;

    const wrap = document.createElement('div');
    wrap.id = 'admin-picker';
    wrap.className = 'admin-picker-wrap';
    wrap.innerHTML = `
        <div class="admin-picker-box">
            <div class="admin-picker-logo">
                <img src="./assets/f1ft-no-bg-logo.png" alt="F1FT" height="20">
            </div>
            <div class="label mb-1 mt-3 accent"><i class="bi bi-shield-lock me-2"></i>ADMIN_ACCESS</div>
            <div class="admin-picker-title">SELECT_CHAMPIONSHIP</div>
            <div class="admin-picker-list" id="admin-champ-list">
                ${championships.map(c => `
                    <div class="admin-champ-opt${c.key === selected ? ' active' : ''}"
                         data-key="${c.key}"
                         onclick="adminPickerSelect('${c.key}')">
                        <span class="admin-champ-key">${c.key}</span>
                        <span class="admin-champ-name">${c.name}</span>
                    </div>`).join('')}
            </div>
            <button class="admin-picker-btn" onclick="adminPickerConfirm()">
                <i class="bi bi-arrow-right-circle me-2"></i>OPEN_CHAMPIONSHIP
            </button>
            <div class="admin-picker-footer">
                F1_FANTASY_TRACKER // ADMIN
            </div>
        </div>`;

    document.body.prepend(wrap);

    // Store selected key on the element for confirm handler
    wrap._selected = selected;
}

function adminPickerSelect(key) {
    const wrap = document.getElementById('admin-picker');
    if (!wrap) return;
    wrap._selected = key;
    document.querySelectorAll('.admin-champ-opt').forEach(el => {
        el.classList.toggle('active', el.dataset.key === key);
    });
    // Enable button
    document.querySelector('.admin-picker-btn').removeAttribute('disabled');
}

function adminPickerConfirm() {
    const wrap = document.getElementById('admin-picker');
    if (!wrap || !wrap._selected) return;
    // Redirect to same origin without role=admin, with key= chosen
    const url = new URL(window.location.href);
    url.searchParams.delete('role');
    url.searchParams.set('key', wrap._selected);
    window.location.href = url.toString();
}

// ── BOOT ──────────────────────────────────────────────────
window.onload = async () => {
    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.get('role') === 'admin';

    if (isAdmin) {
        // Load data silently, then show picker (no boot screen)
        await loadData();
        showAdminPicker(REG.championships ?? []);
        return;
    }

    await bootRun(loadData());

    const key = params.get('key');
    const lg  = key ? REG.championships.find(c => c.key === key) : null;

    if (!lg) {
        document.title = 'F1FT // CHAMP_NOT_FOUND';
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
    nextRound    = deriveNextRound();
    precompute();

    document.getElementById('app-subtitle').innerHTML = `F1_FANTASY_TRACKER <span class="opacity-50">//</span> ${REG.season}`;
    document.getElementById('league-name').textContent  = lg.name;
    document.title = `${lg.name} // F1FT ${REG.season}`;

    selectedRound = currentRound?.id ?? REG.rounds[0].id;
    tabRendered.overview = true;

    startClock();
    renderBanner();
    renderStandings();
    renderCarousel();
    renderHub();

    // Set navbar height CSS var for sticky elements
    const navEl = document.querySelector('.nav-tabs-db');
    if (navEl) document.documentElement.style.setProperty('--navbar-h', navEl.offsetHeight + 'px');
};
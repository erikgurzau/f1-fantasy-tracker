// ── BOOT SCREEN ───────────────────────────────────────────
(function () {
    const LINES = [
        { delay: 0,   html: `<span class="boot-prompt">$</span> <span class="boot-cmd">./f1_fantasy_tracker --init</span>` },
        { delay: 200, html: `<span class="boot-dim">reading key parameter</span>` },
        { delay: 100, html: `<span class="boot-dim">loading resources</span>` },
        { delay: 400, html: `PROGRESS` },
        { delay: 520, html: `<span class="boot-dim">precomputing standings...</span>` },
        { delay: 640, html: `<span class="boot-dim">building player state....</span>` },
    ];

    const DONE_LINE  = `<span class="boot-ok">✓ ready</span>`;
    const READY_LINE = `<span class="boot-prompt">$</span> <span class="boot-cmd">open --league <span class="boot-acc">{key}</span></span> <span class="boot-cursor"></span>`;

    function inject() {
        const screen = document.createElement('div');
        screen.id = 'boot-screen';
        screen.innerHTML = `
            <div class="boot-version">F1_FANTASY_TRACKER // ${new Date().getFullYear()}</div>
            <div class="boot-body" id="boot-body"></div>`;
        document.body.prepend(screen);
    }

    function addLine(html) {
        const body = document.getElementById('boot-body');
        if (!body) return null;
        const el = document.createElement('div');
        el.className = 'boot-line';
        el.innerHTML = html;
        body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('boot-show'));
        return el;
    }

    function addProgressBar() {
        const body = document.getElementById('boot-body');
        if (!body) return;
        const wrap = document.createElement('div');
        wrap.className = 'boot-progress-wrap';
        wrap.innerHTML = `
            <div class="boot-progress-track">
                <div class="boot-progress-fill" id="boot-pf"></div>
            </div>
            <div class="boot-progress-pct" id="boot-pp">0%</div>`;
        body.appendChild(wrap);
        requestAnimationFrame(() => wrap.classList.add('boot-show'));
    }

    function animateProgress(durationMs) {
        const fill = document.getElementById('boot-pf');
        const pct  = document.getElementById('boot-pp');
        if (!fill || !pct) return null;
        const steps = 30;
        const interval = durationMs / steps;
        let step = 0;
        const tick = setInterval(() => {
            step++;
            const p = Math.min(92, Math.round((step / steps) * 92));
            fill.style.width = p + '%';
            pct.textContent  = p + '%';
            if (step >= steps) clearInterval(tick);
        }, interval);
        return tick;
    }

    function finishProgress(tickRef) {
        if (tickRef) clearInterval(tickRef);
        const fill = document.getElementById('boot-pf');
        const pct  = document.getElementById('boot-pp');
        if (fill) fill.style.width = '100%';
        if (pct)  pct.textContent  = '100%';
    }

    window.bootRun = async function (dataPromise) {
        inject();

        const START = performance.now();
        const MIN_MS = 900;

        let progressTick = null;

        LINES.forEach(({ delay, html }) => {
            setTimeout(() => {
                if (html === 'PROGRESS') {
                    addProgressBar();
                    progressTick = animateProgress(400);
                } else {
                    addLine(html);
                }
            }, delay);
        });

        await dataPromise;

        const elapsed = performance.now() - START;
        if (elapsed < MIN_MS) await new Promise(r => setTimeout(r, MIN_MS - elapsed));

        finishProgress(progressTick);
        await new Promise(r => setTimeout(r, 120));

        addLine(DONE_LINE);
        const key = new URLSearchParams(window.location.search).get('key');
        addLine(READY_LINE.replace('{key}', key || '???'));

        await new Promise(r => setTimeout(r, 280));

        const screen = document.getElementById('boot-screen');
        if (screen) {
            screen.classList.add('boot-hidden');
            setTimeout(() => screen.remove(), 350);
        }
    };
})();
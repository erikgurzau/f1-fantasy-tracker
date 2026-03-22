// ── BOOT SCREEN ───────────────────────────────────────────
(function () {
    // Delays are relative to the previous line (cumulative).
    // Total budget across all LINES = ~820ms, well within the 1s cap.
    // If data loads faster the sequence is cut short; if slower it waits.
    const LINES = [
        { delay:   0, html: `<span class="boot-prompt">$</span> <span class="boot-cmd">./f1_fantasy_tracker --init</span>` },
        { delay:  60, html: `<span class="boot-dim">reading url params...</span>` },
        { delay:  70, html: `<span class="boot-dim">resolving league key...</span>` },
        { delay:  80, html: `<span class="boot-dim">fetching registry.json...</span>` },
        { delay:  80, html: `<span class="boot-dim">fetching points.json...</span>` },
        { delay: 100, html: `PROGRESS` },
        { delay:  90, html: `<span class="boot-dim">parsing round data...</span>` },
        { delay:  80, html: `<span class="boot-dim">deriving current round...</span>` },
        { delay:  80, html: `<span class="boot-dim">precomputing standings...</span>` },
        { delay:  80, html: `<span class="boot-dim">building player state...</span>` },
        { delay:  80, html: `<span class="boot-dim">computing budget values...</span>` },
        { delay:  80, html: `<span class="boot-dim">scoring round wins...</span>` },
        { delay:  80, html: `<span class="boot-dim">preparing session data...</span>` },
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
        // real screen is now covering everything — drop the static cover
        const cover = document.getElementById('boot-cover');
        if (cover) cover.remove();
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

        const START   = performance.now();
        const MAX_MS  = 1000; // cap the animation at 1 second

        let progressTick = null;
        let cumDelay = 0;

        // Schedule all lines within the 1s budget
        LINES.forEach(({ delay, html }) => {
            cumDelay += delay;
            const d = Math.min(cumDelay, MAX_MS - 100); // clamp so last line fires before cap
            setTimeout(() => {
                if (html === 'PROGRESS') {
                    addProgressBar();
                    progressTick = animateProgress(300);
                } else {
                    addLine(html);
                }
            }, d);
        });

        // Wait for data OR the 1s cap — whichever is longer
        await Promise.all([
            dataPromise,
            new Promise(r => setTimeout(r, MAX_MS)),
        ]);

        finishProgress(progressTick);
        await new Promise(r => setTimeout(r, 80));

        addLine(DONE_LINE);
        const key = new URLSearchParams(window.location.search).get('key');
        addLine(READY_LINE.replace('{key}', key || '???'));

        await new Promise(r => setTimeout(r, 220));

        const screen = document.getElementById('boot-screen');
        if (screen) {
            screen.classList.add('boot-hidden');
            setTimeout(() => screen.remove(), 350);
        }
    };
})();
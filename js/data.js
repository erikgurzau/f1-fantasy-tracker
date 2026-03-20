// ── DATA LOADING & PRECOMPUTE ─────────────────────────────
// Depends on: common.js

async function loadData() {
    [REG, RESULTS] = await Promise.all([
        fetch('./data/registry.json').then(r => r.json()),
        fetch('./data/points.json').then(r => r.json()).catch(() => ({})),
    ]);
}

function latestPrice(code, type) {
    let price = null;
    for (const r of REG.rounds) {
        const rd = RESULTS[r.id]; if (!rd) continue;
        const entry = rd[type]?.[code];
        if (entry?.price != null) price = entry.price;
    }
    return price;
}

function precompute() {
    REG.championships.forEach(champ => {
        const players = champ.players.map(p => {
            const rounds = {};
            let totalPts = 0, totalExp = 0;

            REG.rounds.forEach(r => {
                const rd = RESULTS[r.id]; if (!rd) return;
                let rPts = 0, rExp = 0;
                const dBrk = {}, cBrk = {};

                [p.team.captain, ...p.team.drivers].forEach(d => {
                    const isCap = d === p.team.captain;
                    const base  = rd.drivers[d]; if (!base) return;
                    const pts   = isCap ? base.pts * 2 : base.pts;
                    const exp   = isCap ? base.exp * 2 : base.exp;
                    dBrk[d] = { pts: base.pts, exp: base.exp, isCap };
                    rPts += pts; rExp += exp;
                });

                p.team.constructors.forEach(c => {
                    const base = rd.constructors[c]; if (!base) return;
                    cBrk[c] = { pts: base.pts, exp: base.exp };
                    rPts += base.pts; rExp += base.exp;
                });

                const acc = rExp !== 0
                    ? Math.max(0, 100 - Math.abs(rPts - rExp) / Math.abs(rExp) * 100)
                    : 0;
                rounds[r.id] = { pts: rPts, exp: rExp, acc, drivers: dBrk, constructors: cBrk };
                totalPts += rPts; totalExp += rExp;
            });

            const totalAcc = totalExp !== 0
                ? Math.max(0, 100 - Math.abs(totalPts - totalExp) / Math.abs(totalExp) * 100)
                : 0;

            const allDrivers  = [p.team.captain, ...p.team.drivers];
            const budgetInit  = allDrivers.reduce((s, d) => s + (REG.drivers[d]?.init_price ?? 0), 0)
                              + p.team.constructors.reduce((s, c) => s + (REG.constructors[c]?.init_price ?? 0), 0);
            const budgetCurr  = allDrivers.reduce((s, d) => s + (latestPrice(d, 'drivers') ?? REG.drivers[d]?.init_price ?? 0), 0)
                              + p.team.constructors.reduce((s, c) => s + (latestPrice(c, 'constructors') ?? REG.constructors[c]?.init_price ?? 0), 0);

            return { ...p, rounds, totalPts, totalExp, totalAcc, budgetInit, budgetCurr };
        });

        const sorted     = [...players].sort((a, b) => b.totalPts - a.totalPts);
        const leaderPts  = sorted[0]?.totalPts ?? 0;
        sorted.forEach((p, i) => { p.rank = i + 1; p.gap = p.totalPts - leaderPts; });
        sorted.forEach(p => { p.wins = 0; });

        REG.rounds.filter(r => isRoundComplete(r)).forEach(r => {
            let best = -Infinity, winners = [];
            players.forEach(p => {
                const rp = p.rounds[r.id]?.pts ?? -Infinity;
                if (rp > best)       { best = rp; winners = [p.code]; }
                else if (rp === best) winners.push(p.code);
            });
            winners.forEach(code => {
                const p = sorted.find(x => x.code === code);
                if (p) p.wins++;
            });
        });

        STATE[champ.key] = { players: sorted };
    });
}

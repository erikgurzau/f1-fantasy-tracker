// ── DATA LOADING & PRECOMPUTE ─────────────────────────────
// Depends on: common.js

async function loadData() {
    [REG, RESULTS] = await Promise.all([
        fetch('./data/registry.json').then(r => r.json()),
        fetch(new URLSearchParams(location.search).has('fake') ? './data/points_fake.json' : './data/points.json').then(r => r.json()).catch(() => ({})),
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

// Transfers: p.team in registry is the STARTING team; p.transfers is an optional list of
// { round, out, in } (effective from `round` included) or { round, captain } (captain swap).
function applyTransfer(team, t) {
    const next = { captain: team.captain, drivers: [...team.drivers], constructors: [...team.constructors] };
    if (t.captain && !t.out) {
        const i = next.drivers.indexOf(t.captain);
        if (i >= 0) next.drivers[i] = next.captain;
        next.captain = t.captain;
        return next;
    }
    if (next.captain === t.out) next.captain = t.in;
    else if (next.drivers.includes(t.out)) next.drivers[next.drivers.indexOf(t.out)] = t.in;
    else if (next.constructors.includes(t.out)) next.constructors[next.constructors.indexOf(t.out)] = t.in;
    return next;
}

function teamAtRound(startTeam, transfers, roundIdx) {
    return transfers.reduce((team, t) =>
        REG.rounds.findIndex(r => r.id === t.round) <= roundIdx ? applyTransfer(team, t) : team, startTeam);
}

function precompute() {
    REG.championships.forEach(champ => {
        const players = champ.players.map(pl => {
            const startTeam = pl.team;
            const transfers = [...(pl.transfers ?? [])]
                .sort((a, b) => REG.rounds.findIndex(r => r.id === a.round) - REG.rounds.findIndex(r => r.id === b.round));
            const p = { ...pl, startTeam, transfers, team: teamAtRound(startTeam, transfers, REG.rounds.length - 1) };
            const rounds = {};
            const outPts = {}; // points earned by pieces no longer in the current team
            let totalPts = 0, totalExp = 0;

            REG.rounds.forEach((r, ri) => {
                const rd = RESULTS[r.id]; if (!rd) return;
                const team = teamAtRound(startTeam, transfers, ri);
                let rPts = 0, rExp = 0;
                const dBrk = {}, cBrk = {};

                [team.captain, ...team.drivers].forEach(d => {
                    const isCap = d === team.captain;
                    const base  = rd.drivers[d]; if (!base) return;
                    const pts   = isCap ? base.pts * 2 : base.pts;
                    const exp   = isCap ? base.exp * 2 : base.exp;
                    dBrk[d] = { pts: base.pts, exp: base.exp, isCap };
                    rPts += pts; rExp += exp;
                    if (d !== p.team.captain && !p.team.drivers.includes(d)) outPts[d] = (outPts[d] ?? 0) + pts;
                });

                team.constructors.forEach(c => {
                    const base = rd.constructors[c]; if (!base) return;
                    cBrk[c] = { pts: base.pts, exp: base.exp };
                    rPts += base.pts; rExp += base.exp;
                    if (!p.team.constructors.includes(c)) outPts[c] = (outPts[c] ?? 0) + base.pts;
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
            const startDrivers = [startTeam.captain, ...startTeam.drivers];
            const budgetInit  = startDrivers.reduce((s, d) => s + (REG.drivers[d]?.init_price ?? 0), 0)
                              + startTeam.constructors.reduce((s, c) => s + (REG.constructors[c]?.init_price ?? 0), 0);
            const budgetCurr  = allDrivers.reduce((s, d) => s + (latestPrice(d, 'drivers') ?? REG.drivers[d]?.init_price ?? 0), 0)
                              + p.team.constructors.reduce((s, c) => s + (latestPrice(c, 'constructors') ?? REG.constructors[c]?.init_price ?? 0), 0);

            return { ...p, rounds, totalPts, totalExp, totalAcc, budgetInit, budgetCurr, outPts };
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

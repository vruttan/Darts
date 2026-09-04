// Pure, DOM-free double-elimination bracket generation and advancement.
//
// The entire bracket graph (Winners Bracket, Losers Bracket, Grand Final +
// reset) is generated upfront, before any match is played. Every non-seeded
// match slot is filled via an explicit "source" pointer ({matchId, slot})
// rather than an implicit tree, because losers-bracket matches are fed from
// two different places (a previous losers-bracket winner, and a same-round
// winners-bracket loser). Advancement just walks the graph looking for
// matches whose source just completed.

import { nextPowerOfTwo, log2, seedOrder } from "./util.js";

let matchCounter = 0;

function createMatch(matches, order, def) {
  const match = {
    teamAId: null,
    teamBId: null,
    teamASource: null,
    teamBSource: null,
    winnerId: null,
    loserId: null,
    boardNumber: null,
    isBye: false,
    ...def,
  };
  match.status = match.teamAId != null && match.teamBId != null ? "ready" : "pending";
  matches[match.id] = match;
  order.push(match.id);
  return match;
}

function resolveByeIfReady(match) {
  if (match.isBye && match.status !== "complete") {
    const known = match.teamAId != null ? match.teamAId : match.teamBId;
    if (known != null) {
      match.winnerId = known;
      match.loserId = null;
      match.status = "complete";
    }
  }
}

// Whenever a match completes, fill in any downstream match slots that were
// waiting on it, flip fully-known matches to "ready", and cascade through
// any bye matches that just became resolvable as a result.
function propagateFrom(matches, completedMatch) {
  for (const m of Object.values(matches)) {
    if (m.status === "complete") continue;
    if (m.teamASource && m.teamASource.matchId === completedMatch.id && m.teamAId == null) {
      const val = completedMatch[m.teamASource.slot === "winner" ? "winnerId" : "loserId"];
      if (val != null) m.teamAId = val;
    }
    if (m.teamBSource && m.teamBSource.matchId === completedMatch.id && m.teamBId == null) {
      const val = completedMatch[m.teamBSource.slot === "winner" ? "winnerId" : "loserId"];
      if (val != null) m.teamBId = val;
    }
    if (m.isBye) {
      const wasComplete = m.status === "complete";
      resolveByeIfReady(m);
      if (!wasComplete && m.status === "complete") {
        propagateFrom(matches, m);
      }
    } else if (m.teamAId != null && m.teamBId != null && m.status === "pending") {
      m.status = "ready";
    }
  }
}

/**
 * Generate a full double-elimination bracket graph for the given entrant ids.
 * Returns { matches, matchOrder, grandFinal } ready to be embedded into
 * tournament state.
 */
export function generateBracket(teamIds) {
  if (!Array.isArray(teamIds) || teamIds.length < 2) {
    throw new Error("generateBracket requires at least 2 teams");
  }

  matchCounter = 0;
  const n = teamIds.length;
  const size = nextPowerOfTwo(n);
  const k = log2(size);
  const order = seedOrder(size);
  const slots = order.map((seed) => (seed <= n ? teamIds[seed - 1] : null));

  const matches = {};
  const matchOrder = [];

  // ---- Winners Bracket ----
  const wbRounds = [];
  {
    const round1 = [];
    for (let i = 0; i < size / 2; i++) {
      const a = slots[2 * i];
      const b = slots[2 * i + 1];
      const isBye = a == null || b == null;
      round1.push(
        createMatch(matches, matchOrder, {
          id: `wb-r1-m${i + 1}`,
          bracket: "winners",
          round: 1,
          teamAId: a,
          teamBId: b,
          isBye,
        })
      );
    }
    wbRounds.push(round1);
  }
  for (let r = 2; r <= k; r++) {
    const prev = wbRounds[wbRounds.length - 1];
    const round = [];
    for (let i = 0; i < prev.length / 2; i++) {
      round.push(
        createMatch(matches, matchOrder, {
          id: `wb-r${r}-m${i + 1}`,
          bracket: "winners",
          round: r,
          teamASource: { matchId: prev[2 * i].id, slot: "winner" },
          teamBSource: { matchId: prev[2 * i + 1].id, slot: "winner" },
        })
      );
    }
    wbRounds.push(round);
  }

  // ---- Losers Bracket ----
  // Loser "sources" per WB round. Bye matches produce no loser, so round 1
  // excludes them; rounds 2..k are always real matches (byes only ever occur
  // in round 1, since round 2+ always pairs up exactly size/2^r survivors).
  const wbLoserSources = wbRounds.map((round) =>
    round.filter((m) => !m.isBye).map((m) => ({ matchId: m.id, slot: "loser" }))
  );

  const lbRounds = [];
  let pool = wbLoserSources[0];
  let lbRoundNum = 1;
  let nextWbLoserIdx = 1;
  const totalLbRounds = 2 * (k - 1);

  for (let step = 0; step < totalLbRounds; step++) {
    const isMerge = step % 2 === 1;
    const round = [];

    if (!isMerge) {
      // Internal round: pair the current pool up against itself.
      for (let i = 0; i + 1 < pool.length; i += 2) {
        round.push(
          createMatch(matches, matchOrder, {
            id: `lb-r${lbRoundNum}-m${round.length + 1}`,
            bracket: "losers",
            round: lbRoundNum,
            teamASource: pool[i],
            teamBSource: pool[i + 1],
          })
        );
      }
      if (pool.length % 2 === 1) {
        round.push(
          createMatch(matches, matchOrder, {
            id: `lb-r${lbRoundNum}-m${round.length + 1}`,
            bracket: "losers",
            round: lbRoundNum,
            teamASource: pool[pool.length - 1],
            isBye: true,
          })
        );
      }
    } else {
      // Merge round: pair previous LB round's winners against the next WB
      // round's fresh losers. If counts don't match (possible when WB round 1
      // had byes), the excess entrants on either side get a bye through.
      // Fresh losers are reversed so a team's round-1 opponent's subtree
      // stays maximally separated, cutting down on early rematches.
      const fresh = wbLoserSources[nextWbLoserIdx].slice().reverse();
      nextWbLoserIdx += 1;
      const pairCount = Math.min(pool.length, fresh.length);
      for (let i = 0; i < pairCount; i++) {
        round.push(
          createMatch(matches, matchOrder, {
            id: `lb-r${lbRoundNum}-m${round.length + 1}`,
            bracket: "losers",
            round: lbRoundNum,
            teamASource: pool[i],
            teamBSource: fresh[i],
          })
        );
      }
      for (let i = pairCount; i < pool.length; i++) {
        round.push(
          createMatch(matches, matchOrder, {
            id: `lb-r${lbRoundNum}-m${round.length + 1}`,
            bracket: "losers",
            round: lbRoundNum,
            teamASource: pool[i],
            isBye: true,
          })
        );
      }
      for (let i = pairCount; i < fresh.length; i++) {
        round.push(
          createMatch(matches, matchOrder, {
            id: `lb-r${lbRoundNum}-m${round.length + 1}`,
            bracket: "losers",
            round: lbRoundNum,
            teamASource: fresh[i],
            isBye: true,
          })
        );
      }
    }

    lbRounds.push(round);
    pool = round.map((m) => ({ matchId: m.id, slot: "winner" }));
    lbRoundNum += 1;
  }

  // ---- Grand Final ----
  const wbFinalMatch = wbRounds[wbRounds.length - 1][0];
  const wbChampionSource = { matchId: wbFinalMatch.id, slot: "winner" };
  const lbChampionSource =
    lbRounds.length > 0
      ? { matchId: lbRounds[lbRounds.length - 1][0].id, slot: "winner" }
      : { matchId: wbFinalMatch.id, slot: "loser" };

  createMatch(matches, matchOrder, {
    id: "gf-1",
    bracket: "grandfinal",
    round: 1,
    teamASource: wbChampionSource,
    teamBSource: lbChampionSource,
  });

  createMatch(matches, matchOrder, {
    id: "gf-2",
    bracket: "grandfinal-reset",
    round: 1,
  });

  // Resolve any winners-bracket byes now that the whole graph exists, so
  // downstream matches cascade correctly from the start.
  for (const m of wbRounds[0]) {
    if (m.isBye) {
      resolveByeIfReady(m);
      propagateFrom(matches, m);
    }
  }

  return {
    matches,
    matchOrder,
    grandFinal: {
      game1MatchId: "gf-1",
      resetMatchId: "gf-2",
      resetNeeded: null,
    },
  };
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Given two same-round losers-bracket matches (w vs x) and (y vs z), tries
// the other two ways to re-pair those four teams if the current pairing
// repeats an earlier matchup (anywhere in the bracket) and an alternative
// pairing exists that repeats neither. Mutates the matches in place and
// returns true if a swap was applied.
function resolveRematchBetween(playedPairs, a, b) {
  const w = a.teamAId,
    x = a.teamBId,
    y = b.teamAId,
    z = b.teamBId;
  const aBSource = a.teamBSource,
    bASource = b.teamASource,
    bBSource = b.teamBSource;
  const currentlyRematch = playedPairs.has(pairKey(w, x)) || playedPairs.has(pairKey(y, z));
  if (!currentlyRematch) return false;

  if (!playedPairs.has(pairKey(w, y)) && !playedPairs.has(pairKey(x, z))) {
    a.teamBId = y;
    a.teamBSource = bASource;
    b.teamAId = x;
    b.teamASource = aBSource;
    b.teamBId = z;
    b.teamBSource = bBSource;
    return true;
  }
  if (!playedPairs.has(pairKey(w, z)) && !playedPairs.has(pairKey(x, y))) {
    a.teamBId = z;
    a.teamBSource = bBSource;
    b.teamAId = x;
    b.teamASource = aBSource;
    b.teamBId = y;
    b.teamBSource = bASource;
    return true;
  }
  return false;
}

// Best-effort: within each losers-bracket round, re-pair teams among
// matches that are "ready" but not yet started to avoid repeating a matchup
// that already happened earlier in the bracket (winners or losers side),
// whenever an alternative re-pairing exists that doesn't just trade one
// repeat for another. The bracket graph itself is generated before any
// results exist, so it can't know in advance who will end up facing whom
// (see generateBracket's doc comment) — this only catches rematches once
// both sides of a merge-round pairing are actually known, and only among
// matches still "ready": assignBoards() flips a match straight to
// "in-progress" the instant it claims a board, so a match already showing
// on a board is never eligible here and is left untouched. That means a
// round where boards fill matches faster than the round's own pairings
// resolve can end up with no eligible partner left to swap against, which
// this function silently accepts rather than delaying board assignment to
// wait for it (see recordResult in boards.js for the fill-order tradeoff).
function avoidLosersRematches(state) {
  const playedPairs = new Set();
  for (const m of Object.values(state.matches)) {
    if (m.status === "complete" && m.teamAId != null && m.teamBId != null) {
      playedPairs.add(pairKey(m.teamAId, m.teamBId));
    }
  }

  const byRound = new Map();
  for (const m of Object.values(state.matches)) {
    if (m.bracket !== "losers" || m.status !== "ready" || m.isBye) continue;
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round).push(m);
  }

  // A single pass over every pair suffices: resolveRematchBetween only ever
  // applies a swap that leaves both matches clean (not in playedPairs), and
  // playedPairs never changes during this function, so a match can't be
  // re-dirtied by a later swap — rescanning from the top can't find anything
  // a linear pass would have missed.
  for (const group of byRound.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        resolveRematchBetween(playedPairs, group[i], group[j]);
      }
    }
  }
}

function handleGrandFinalLogic(state) {
  const gf = state.grandFinal;
  const game1 = state.matches[gf.game1MatchId];
  if (game1.status !== "complete" || gf.resetNeeded !== null) return;

  if (game1.winnerId === game1.teamAId) {
    gf.resetNeeded = false;
  } else {
    gf.resetNeeded = true;
    const reset = state.matches[gf.resetMatchId];
    reset.teamAId = game1.teamAId;
    reset.teamBId = game1.teamBId;
    reset.status = "ready";
  }
}

function checkChampion(state) {
  const gf = state.grandFinal;
  const game1 = state.matches[gf.game1MatchId];
  if (game1.status === "complete" && gf.resetNeeded === false) {
    state.championTeamId = game1.winnerId;
    state.phase = "complete";
    return;
  }
  const reset = state.matches[gf.resetMatchId];
  if (reset.status === "complete") {
    state.championTeamId = reset.winnerId;
    state.phase = "complete";
  }
}

/**
 * Record the result of a match and advance the bracket: frees the match's
 * board, propagates the winner/loser into downstream matches, handles grand
 * final / bracket-reset activation, and checks for an overall champion.
 * Mutates `state` (expects state.matches and state.grandFinal at minimum).
 */
export function completeMatch(state, matchId, winnerId) {
  const match = state.matches[matchId];
  if (!match) throw new Error(`Unknown match id: ${matchId}`);
  if (winnerId !== match.teamAId && winnerId !== match.teamBId) {
    throw new Error(`winnerId ${winnerId} is not a participant in match ${matchId}`);
  }
  const loserId = winnerId === match.teamAId ? match.teamBId : match.teamAId;
  match.winnerId = winnerId;
  match.loserId = loserId;
  match.status = "complete";

  propagateFrom(state.matches, match);
  // Grand final / reset completions can never ready a losers-bracket match
  // (nothing downstream of them feeds the LB), so skip the scan there.
  if (match.bracket !== "grandfinal" && match.bracket !== "grandfinal-reset") {
    avoidLosersRematches(state);
  }
  handleGrandFinalLogic(state);
  checkChampion(state);

  return match;
}

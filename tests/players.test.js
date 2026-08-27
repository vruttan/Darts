// Plain assert-based test harness for players.js's random/manual pairing and
// the hybrid "unpair one team, re-pair by hand" flow. Same style as
// tests/boards.test.js: run with `node tests/players.test.js`. players.js
// has zero DOM dependencies (only imports shuffle/makeId from util.js), so
// this runs directly under Node.

import {
  generateTeams,
  startManualPairing,
  isManualPairingComplete,
  selectManualPlayer,
  unpairTeam,
} from "../js/players.js";

let passCount = 0;
let failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function test(name, fn) {
  try {
    fn();
    passCount++;
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
  }
}

function makePlayers(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, sittingOut: false }));
}

function newState(playerCount) {
  return { players: makePlayers(playerCount), teams: [], manualPairing: null };
}

// ---- unpairTeam on a random-mode team ----
test("unpairTeam on a random-mode team populates manualPairing and removes the team", () => {
  const state = newState(4);
  generateTeams(state);
  assert(state.manualPairing === null, "manualPairing should be null right after generateTeams");
  assert(state.teams.length === 2, "expected 2 teams from 4 players");

  const [teamToEdit] = state.teams;
  unpairTeam(state, teamToEdit.id);

  assert(state.teams.length === 1, "the edited team should be removed from state.teams");
  assert(state.manualPairing !== null, "manualPairing should now be populated");
  assert(state.manualPairing.selectedId === null, "selectedId should start unset");
  const pool = state.manualPairing.unpairedIds.slice().sort();
  assert(
    JSON.stringify(pool) === JSON.stringify(teamToEdit.playerIds.slice().sort()),
    `expected unpairedIds to be exactly ${teamToEdit.playerIds}, got ${pool}`
  );
});

// ---- Odd count: unpairing folds the existing sit-out player into the pool ----
test("unpairing a team with an odd player count folds the sit-out player into the pool", () => {
  const state = newState(5);
  const { sitOutPlayerId } = generateTeams(state);
  assert(sitOutPlayerId != null, "5 players should produce a sit-out player");
  assert(state.players.find((p) => p.id === sitOutPlayerId).sittingOut, "sit-out player should be flagged");

  const [teamToEdit] = state.teams;
  unpairTeam(state, teamToEdit.id);

  assert(
    state.manualPairing.unpairedIds.includes(sitOutPlayerId),
    "the previously sitting-out player should be folded into the pool, not dropped"
  );
  assert(state.manualPairing.unpairedIds.length === 3, `expected 3 unpaired players, got ${state.manualPairing.unpairedIds.length}`);
  assert(!isManualPairingComplete(state), "pairing should not be complete with 3 unpaired players");
  assert(!state.players.some((p) => p.sittingOut), "no player should be flagged sitting out while 3 are unpaired");
});

// ---- Unpairing two teams and re-pairing across them (the swap the "Edit" button enables) ----
test("unpairing two random teams and re-pairing across them produces a valid new team set", () => {
  const state = newState(4);
  generateTeams(state);
  const [teamA, teamB] = state.teams;
  const [a, b] = teamA.playerIds;
  const [c, d] = teamB.playerIds;

  unpairTeam(state, teamA.id);
  unpairTeam(state, teamB.id);
  assert(state.teams.length === 0, "both teams should be removed");
  assert(state.manualPairing.unpairedIds.length === 4, "all 4 players should be in the pool");

  // Cross-pair: a+c and b+d (a swap that wasn't possible with the original random pairing).
  selectManualPlayer(state, a);
  selectManualPlayer(state, c);
  selectManualPlayer(state, b);
  selectManualPlayer(state, d);

  assert(isManualPairingComplete(state), "pairing should be complete after both new pairs are formed");
  assert(state.teams.length === 2, `expected 2 new teams, got ${state.teams.length}`);
  const memberSets = state.teams.map((t) => t.playerIds.slice().sort().join(","));
  assert(memberSets.includes([a, c].sort().join(",")), "expected a+c to be paired");
  assert(memberSets.includes([b, d].sort().join(",")), "expected b+d to be paired");
  assert(state.manualPairing.unpairedIds.length === 0, "no players should remain unpaired");
});

// ---- isManualPairingComplete transitions correctly through the hybrid flow ----
test("isManualPairingComplete transitions correctly through unpair + re-pair", () => {
  const state = newState(4);
  generateTeams(state);
  assert(isManualPairingComplete(state), "complete before any edit (manualPairing is null)");

  const [teamA, teamB] = state.teams;
  const [a, b] = teamA.playerIds;
  const [c, d] = teamB.playerIds;

  unpairTeam(state, teamA.id);
  assert(!isManualPairingComplete(state), "not complete after unpairing one team (2 unpaired)");

  unpairTeam(state, teamB.id);
  assert(!isManualPairingComplete(state), "not complete after unpairing a second team (4 unpaired)");

  selectManualPlayer(state, a);
  selectManualPlayer(state, c);
  assert(!isManualPairingComplete(state), "not complete with one new pair formed, 2 still unpaired");

  selectManualPlayer(state, b);
  selectManualPlayer(state, d);
  assert(isManualPairingComplete(state), "complete once both new pairs are formed");
});

// ---- generateTeams clears a stale/incomplete manualPairing ----
test("generateTeams clears a stale incomplete manualPairing session", () => {
  const state = newState(4);
  startManualPairing(state);
  const [p1, p2] = state.players.map((p) => p.id);
  selectManualPlayer(state, p1);
  selectManualPlayer(state, p2);
  assert(!isManualPairingComplete(state), "expected an incomplete manual session (1 team formed, 2 unpaired)");

  generateTeams(state);

  assert(state.manualPairing === null, "generateTeams should discard the stale manualPairing session");
  assert(state.teams.length === 2, "generateTeams should produce a fresh, fully-formed random team set");
});

// ---- unpairTeam with a stale/unknown id is a no-op ----
test("unpairTeam with an unknown team id is a no-op", () => {
  const state = newState(4);
  generateTeams(state);
  const teamsBefore = JSON.stringify(state.teams);
  const manualPairingBefore = state.manualPairing;

  unpairTeam(state, "not-a-real-id");

  assert(JSON.stringify(state.teams) === teamsBefore, "state.teams should be unchanged");
  assert(state.manualPairing === manualPairingBefore, "state.manualPairing should be unchanged");
});

// ---- Sit-out player is unaffected by an unrelated team edit ----
test("sit-out player is unaffected by unpairing and re-pairing an unrelated team", () => {
  const state = newState(5);
  const { sitOutPlayerId } = generateTeams(state);
  const [teamToEdit] = state.teams;
  const [x, y] = teamToEdit.playerIds;

  unpairTeam(state, teamToEdit.id);
  selectManualPlayer(state, x);
  selectManualPlayer(state, y);

  assert(isManualPairingComplete(state), "pairing should be complete once the edited team is re-formed");
  const sittingOut = state.players.filter((p) => p.sittingOut);
  assert(sittingOut.length === 1, `expected exactly one sit-out player, got ${sittingOut.length}`);
  assert(sittingOut[0].id === sitOutPlayerId, "the original sit-out player should still be the one sitting out");
});

// ---- Report ----
console.log(`${passCount} passed, ${failures.length} failed`);
for (const f of failures) console.log(`FAIL: ${f}`);
if (failures.length > 0) process.exit(1);

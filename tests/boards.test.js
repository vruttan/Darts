// Plain assert-based test harness for boards.js's edit-result flow (rebuild +
// replay). Same style as tests/bracket.test.js: run with
// `node tests/boards.test.js`. boards.js/bracket.js have zero DOM
// dependencies, so this runs directly under Node.

import { generateBracket } from "../js/bracket.js";
import {
  recordResult,
  assignBoards,
  readyMatches,
  inProgressMatches,
  simulateEditResult,
  editResult,
  matchUnlocksGrandFinal,
} from "../js/boards.js";

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

function makeTeams(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `team${i + 1}`, name: `Team ${i + 1}` }));
}

// Builds a state shaped like the real app's (state.js's startTournament),
// without going through state.js so this stays localStorage-free.
function newTournamentState(n, boardCount) {
  const teams = makeTeams(n);
  const bracket = generateBracket(teams.map((t) => t.id));
  const boardNames = Array.from({ length: boardCount }, (_, i) => `Board ${i + 1}`);
  const state = {
    teams,
    boardNames,
    matches: bracket.matches,
    matchOrder: bracket.matchOrder,
    grandFinal: bracket.grandFinal,
    boards: boardNames.map((name, i) => ({ number: i + 1, name, matchId: null })),
    championTeamId: null,
    completedMatchIds: [],
    phase: "live",
  };
  assignBoards(state);
  return state;
}

// Plays every playable match repeatedly (skipping stopMatchId) via
// recordResult, until none remain. A match is playable once it's "ready" or
// (since recordResult's assignBoards immediately claims free boards) already
// "in-progress" on one.
function playAllExcept(state, chooseWinner, stopMatchId = null) {
  let iterations = 0;
  const maxIterations = 10000;
  while (iterations++ < maxIterations) {
    const playable = readyMatches(state)
      .concat(inProgressMatches(state))
      .filter((m) => m.id !== stopMatchId);
    if (playable.length === 0) break;
    for (const m of playable) {
      recordResult(state, m.id, chooseWinner(m));
    }
  }
  assert(iterations < maxIterations, "simulation did not terminate (possible infinite loop / bad wiring)");
}

function countLosses(state) {
  const losses = {};
  for (const id of state.matchOrder) {
    const m = state.matches[id];
    if (m.status === "complete" && !m.isBye && m.loserId != null) {
      losses[m.loserId] = (losses[m.loserId] || 0) + 1;
    }
  }
  return losses;
}

function assertSingleChampionWithCorrectLosses(state, teamIds) {
  assert(state.phase === "complete", "tournament did not reach complete phase");
  assert(state.championTeamId != null, "no champion was set");
  const losses = countLosses(state);
  for (const teamId of teamIds) {
    const loss = losses[teamId] || 0;
    if (teamId === state.championTeamId) {
      assert(loss === 0 || loss === 1, `champion ${teamId} should have 0 or 1 losses, got ${loss}`);
    } else {
      assert(loss === 2, `eliminated team ${teamId} should have exactly 2 losses, got ${loss}`);
    }
  }
}

// ---- Editing the decisive match with nothing downstream of it yet ----
test("editing the last-played match (gf-1, no reset yet) has no reopened matches", () => {
  const state = newTournamentState(8, 8);
  const chooseA = (m) => m.teamAId;
  playAllExcept(state, chooseA, "gf-1");

  const gf1 = state.matches["gf-1"];
  recordResult(state, "gf-1", gf1.teamAId); // WB side wins -> no reset needed
  assert(state.phase === "complete", "should be complete before the edit");
  assert(state.grandFinal.resetNeeded === false, "resetNeeded should be false before the edit");

  const preview = simulateEditResult(state, "gf-1", gf1.teamBId);
  assert(preview.reopenedMatchIds.length === 0, `expected no reopened matches, got ${preview.reopenedMatchIds}`);

  editResult(state, "gf-1", gf1.teamBId); // flip to the LB side instead
  assert(state.grandFinal.resetNeeded === true, "resetNeeded should now be true");
  assert(state.phase === "live", "phase should revert to live, a reset must be played");
  assert(state.championTeamId == null, "champion should be unset until the reset is played");
  const gf2Status = state.matches["gf-2"].status;
  assert(gf2Status === "ready" || gf2Status === "in-progress", `gf-2 should now be playable, got status ${gf2Status}`);
});

// ---- Editing an early match reopens exactly its downstream, not siblings ----
test("editing an early WB round-1 match reopens its downstream matches only", () => {
  const state = newTournamentState(8, 8);
  const chooseA = (m) => m.teamAId;
  playAllExcept(state, chooseA);
  assertSingleChampionWithCorrectLosses(state, state.teams.map((t) => t.id));

  const edited = state.matches["wb-r1-m1"];
  const originalWinnerId = edited.winnerId;
  const flippedWinnerId = edited.loserId;

  // Every match sourced directly from wb-r1-m1 must change team composition
  // and therefore be reopened.
  const directChildren = Object.values(state.matches).filter(
    (m) =>
      (m.teamASource && m.teamASource.matchId === "wb-r1-m1") || (m.teamBSource && m.teamBSource.matchId === "wb-r1-m1")
  );
  assert(directChildren.length > 0, "expected wb-r1-m1 to feed at least one downstream match");

  const { reopenedMatchIds } = simulateEditResult(state, "wb-r1-m1", flippedWinnerId);
  for (const child of directChildren) {
    assert(reopenedMatchIds.includes(child.id), `expected ${child.id} to be reopened by editing wb-r1-m1`);
  }

  // A same-round sibling untouched by wb-r1-m1's outcome should not be reopened.
  assert(!reopenedMatchIds.includes("wb-r1-m4"), "sibling match wb-r1-m4 should not be reopened");

  editResult(state, "wb-r1-m1", flippedWinnerId);
  assert(state.matches["wb-r1-m1"].winnerId === flippedWinnerId, "edited match should record the new winner");
  assert(
    state.matches["wb-r1-m4"].winnerId === originalWinnerId || state.matches["wb-r1-m4"].winnerId != null,
    "sibling match wb-r1-m4 should keep its own recorded result"
  );
  for (const child of directChildren) {
    assert(
      !state.completedMatchIds.includes(child.id) || state.matches[child.id].status === "complete",
      `reopened match ${child.id} should either be unplayed or freshly replayed, never left half-updated`
    );
  }

  // Finishing the tournament from here must still produce valid invariants.
  playAllExcept(state, chooseA);
  assertSingleChampionWithCorrectLosses(state, state.teams.map((t) => t.id));
});

// ---- Grand final: editing game 1 after a reset was played reopens gf-2 ----
test("editing gf-1 after a bracket reset was played reopens and clears gf-2", () => {
  const state = newTournamentState(6, 6);
  const chooseA = (m) => m.teamAId;
  playAllExcept(state, chooseA, "gf-1");

  const gf1 = state.matches["gf-1"];
  recordResult(state, "gf-1", gf1.teamBId); // LB side wins game 1 -> reset triggered
  assert(state.grandFinal.resetNeeded === true, "resetNeeded should be true");
  const reset = state.matches["gf-2"];
  assert(reset.status === "ready" || reset.status === "in-progress", `reset match should be playable, got status ${reset.status}`);
  recordResult(state, "gf-2", reset.teamAId); // WB side wins the reset -> champion
  assert(state.phase === "complete", "should be complete after the reset is played");
  assert(state.completedMatchIds.includes("gf-2"), "gf-2 should be recorded as completed");

  const preview = simulateEditResult(state, "gf-1", gf1.teamAId); // flip gf-1 back to the WB side
  assert(preview.reopenedMatchIds.includes("gf-2"), "gf-2 should be reopened since no reset is needed anymore");

  editResult(state, "gf-1", gf1.teamAId);
  assert(state.grandFinal.resetNeeded === false, "resetNeeded should flip to false");
  assert(state.matches["gf-2"].status === "pending", "gf-2 should revert to pending");
  assert(
    state.matches["gf-2"].teamAId == null && state.matches["gf-2"].teamBId == null,
    "gf-2 should be unpopulated again"
  );
  assert(state.championTeamId === gf1.teamAId, "champion should immediately be the new gf-1 winner");
  assert(state.phase === "complete", "phase should be complete again immediately, no reset needed");
  assert(!state.completedMatchIds.includes("gf-2"), "gf-2 should no longer be in the completed log");
});

// ---- matchUnlocksGrandFinal: flags exactly the match whose completion makes gf-1 ready ----
// The WB final's loser feeds the LB final, so gf-1's two feeders aren't
// independent — playing serially (one board) lets this check the predicate
// against every single completion in a real playthrough, not just a
// hand-picked pair.
test("matchUnlocksGrandFinal predicts exactly the match that flips gf-1 out of pending", () => {
  const state = newTournamentState(8, 1);
  const chooseA = (m) => m.teamAId;

  assert(!matchUnlocksGrandFinal(state, "wb-r1-m1"), "an early, unrelated match should never unlock gf-1");

  let iterations = 0;
  while (state.matches["gf-1"].status === "pending" && iterations++ < 10000) {
    const playable = readyMatches(state).concat(inProgressMatches(state));
    assert(playable.length > 0, "should always have a playable match before gf-1 is ready");
    const m = playable[0];
    const predicted = matchUnlocksGrandFinal(state, m.id);
    recordResult(state, m.id, chooseA(m));
    const nowReady = state.matches["gf-1"].status !== "pending";
    assert(predicted === nowReady, `matchUnlocksGrandFinal(${m.id}) predicted ${predicted} but gf-1 ready=${nowReady}`);
  }
  assert(state.matches["gf-1"].status !== "pending", "gf-1 should eventually become ready");
});

// ---- Without a championship board pick, gf-1 is assigned normally like any other match ----
test("gf-1 gets assigned to a free board as usual when no championshipBoardNumber is set", () => {
  const state = newTournamentState(8, 2);
  const chooseA = (m) => m.teamAId;

  playAllExcept(state, chooseA, "gf-1");

  assert(
    state.matches["gf-1"].status === "in-progress",
    `gf-1 should be actively assigned to a board, got status ${state.matches["gf-1"].status}`
  );
  const hostingBoard = state.boards.find((b) => b.matchId === "gf-1");
  assert(hostingBoard, "some board should be hosting gf-1");
});

// ---- championshipBoardNumber pins the Grand Final to a specific board ----
test("championshipBoardNumber reserves that board for gf-1, no other board steals it", () => {
  const state = newTournamentState(8, 2);
  const chooseA = (m) => m.teamAId;
  state.championshipBoardNumber = 2;

  playAllExcept(state, chooseA, "gf-1");

  assert(
    state.matches["gf-1"].status === "ready" || state.matches["gf-1"].status === "in-progress",
    "gf-1 should be playable once both feeders are done"
  );

  const board2 = state.boards.find((b) => b.number === 2);
  assert(board2.matchId === "gf-1", `expected gf-1 pinned to board 2, board2.matchId=${board2.matchId}`);
  const board1 = state.boards.find((b) => b.number === 1);
  assert(board1.matchId !== "gf-1", "board 1 should never take the pinned Grand Final match");
});

// ---- avoidLosersRematches must never touch a match once it holds a board ----
test("a match already assigned a board is never mutated by rematch avoidance", () => {
  // Few boards relative to bracket width so matches sit in-progress across
  // multiple recordResult() calls, giving later completions in the same
  // losers-bracket round a chance to try (and be refused) mutating them.
  const state = newTournamentState(10, 2);
  const boardedTeams = new Map();

  let iterations = 0;
  const maxIterations = 10000;
  while (iterations++ < maxIterations) {
    for (const m of inProgressMatches(state)) {
      if (!boardedTeams.has(m.id)) {
        boardedTeams.set(m.id, { teamAId: m.teamAId, teamBId: m.teamBId });
      }
    }
    for (const [id, snap] of boardedTeams) {
      const m = state.matches[id];
      assert(
        m.teamAId === snap.teamAId && m.teamBId === snap.teamBId,
        `${id} was mutated after being assigned a board (was ${snap.teamAId}/${snap.teamBId}, now ${m.teamAId}/${m.teamBId})`
      );
    }
    const playable = readyMatches(state).concat(inProgressMatches(state));
    if (playable.length === 0) break;
    for (const m of playable) recordResult(state, m.id, m.teamAId);
  }
  assert(iterations < maxIterations, "simulation did not terminate (possible infinite loop / bad wiring)");
  assert(state.phase === "complete", "tournament did not reach complete phase");
});

// ---- Report ----
console.log(`${passCount} passed, ${failures.length} failed`);
for (const f of failures) console.log(`FAIL: ${f}`);
if (failures.length > 0) process.exit(1);

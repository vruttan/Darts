// Ready-match queue and automatic board assignment.

import { completeMatch } from "./bracket.js";

export function readyMatches(state) {
  return state.matchOrder.map((id) => state.matches[id]).filter((m) => m.status === "ready");
}

export function inProgressMatches(state) {
  return state.matchOrder.map((id) => state.matches[id]).filter((m) => m.status === "in-progress");
}

// Fills any free boards with the next ready matches (in stable match order).
export function assignBoards(state) {
  const freeBoards = state.boards.filter((b) => b.matchId === null);
  const queue = readyMatches(state);
  for (const board of freeBoards) {
    const next = queue.shift();
    if (!next) break;
    board.matchId = next.id;
    next.boardNumber = board.number;
    next.status = "in-progress";
  }
}

function freeBoardForMatch(state, matchId) {
  const board = state.boards.find((b) => b.matchId === matchId);
  if (board) board.matchId = null;
}

// Single mutation entry point for recording a match result: advances the
// bracket, frees the board that match was on, and fills any now-free boards
// with newly-ready matches.
export function recordResult(state, matchId, winnerId) {
  freeBoardForMatch(state, matchId);
  completeMatch(state, matchId, winnerId);
  assignBoards(state);
  return state;
}

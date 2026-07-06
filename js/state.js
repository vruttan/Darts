// Single source of truth for tournament state, plus localStorage persistence.
// All mutations should flow through the functions here (or players.js /
// boards.js, which operate on the same state object) so state.save() is
// called consistently after every action.

import { generateBracket } from "./bracket.js";
import { assignBoards } from "./boards.js";

const STORAGE_KEY = "darts-tournament-state";
const SCHEMA_VERSION = 1;

export function createInitialState() {
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    phase: "setup", // setup -> teams -> boards -> live -> complete
    boardCount: 3,
    players: [],
    teams: [],
    teamsMode: null, // "random" | "manual", set once pairing begins
    manualPairing: null, // { unpairedIds, selectedId }, only set during manual pairing
    matches: {},
    matchOrder: [],
    completedMatchIds: [], // match ids in the order recordResult() completed them
    boards: [],
    grandFinal: null,
    championTeamId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function save(state) {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (state.version !== SCHEMA_VERSION) return null;
    return state;
  } catch {
    return null;
  }
}

export function clear() {
  localStorage.removeItem(STORAGE_KEY);
}

export function setBoardCount(state, count) {
  state.boardCount = Math.max(1, Math.min(5, Math.round(count) || 1));
}

// Generates the full bracket graph from the current teams and moves into
// the live tournament phase, filling boards with the first ready matches.
export function startTournament(state) {
  const teamIds = state.teams.map((t) => t.id);
  const bracket = generateBracket(teamIds);
  state.matches = bracket.matches;
  state.matchOrder = bracket.matchOrder;
  state.grandFinal = bracket.grandFinal;
  state.boards = Array.from({ length: state.boardCount }, (_, i) => ({ number: i + 1, matchId: null }));
  state.championTeamId = null;
  state.phase = "live";
  assignBoards(state);
}

export function resetTournament() {
  clear();
  return createInitialState();
}

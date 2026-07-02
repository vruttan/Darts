// Player entry, random team pairing, and odd-player-sits-out handling.

import { shuffle, makeId } from "./util.js";

export function addPlayer(state, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const player = { id: makeId("p"), name: trimmed, sittingOut: false };
  state.players.push(player);
  return player;
}

export function removePlayer(state, playerId) {
  state.players = state.players.filter((p) => p.id !== playerId);
}

function teamName(players, playerIds) {
  return playerIds.map((id) => players.find((p) => p.id === id).name).join(" & ");
}

// Randomly pairs all players into teams of 2. If the player count is odd,
// one randomly chosen player sits out. Overwrites any existing teams.
export function generateTeams(state) {
  const shuffled = shuffle(state.players);
  const pool = shuffled.slice();
  let sitOutPlayer = null;
  if (pool.length % 2 === 1) {
    sitOutPlayer = pool.pop();
  }

  const teams = [];
  for (let i = 0; i < pool.length; i += 2) {
    const playerIds = [pool[i].id, pool[i + 1].id];
    teams.push({ id: makeId("t"), name: teamName(state.players, playerIds), playerIds });
  }

  for (const p of state.players) {
    p.sittingOut = sitOutPlayer != null && p.id === sitOutPlayer.id;
  }
  state.teams = teams;
  return { sitOutPlayerId: sitOutPlayer ? sitOutPlayer.id : null };
}

// Swaps who sits out: the given player takes the current sit-out player's
// place on a team, and the current sit-out player sits out instead. Only
// meaningful when the player count is odd (i.e. there is a sit-out slot).
export function setSitOutPlayer(state, playerId) {
  const currentSitOut = state.players.find((p) => p.sittingOut);
  if (!currentSitOut || currentSitOut.id === playerId) return;

  const team = state.teams.find((t) => t.playerIds.includes(playerId));
  if (!team) return;

  team.playerIds = team.playerIds.map((id) => (id === playerId ? currentSitOut.id : id));
  team.name = teamName(state.players, team.playerIds);

  const incoming = state.players.find((p) => p.id === playerId);
  incoming.sittingOut = true;
  currentSitOut.sittingOut = false;
}

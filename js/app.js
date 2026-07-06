// Entry point: wires state, players, boards, and the view modules together.

import * as Store from "./state.js";
import * as Players from "./players.js";
import { recordResult } from "./boards.js";
import { renderSetupNames, renderManualPairing, renderTeamConfirm, renderBoardCount } from "./ui/setup-view.js";
import { renderMatchView } from "./ui/match-view.js";
import { renderChampionView } from "./ui/champion-view.js";

const root = document.getElementById("app");

let state = Store.load() || Store.createInitialState();

function persistAndRender() {
  Store.save(state);
  render();
}

const app = {
  addPlayer(name) {
    Players.addPlayer(state, name);
    persistAndRender();
  },
  removePlayer(id) {
    Players.removePlayer(state, id);
    persistAndRender();
  },
  goToTeams() {
    Players.generateTeams(state);
    state.teamsMode = "random";
    state.phase = "teams";
    persistAndRender();
  },
  reshuffleTeams() {
    Players.generateTeams(state);
    persistAndRender();
  },
  goToManualTeams() {
    Players.startManualPairing(state);
    state.teamsMode = "manual";
    state.phase = "teams";
    persistAndRender();
  },
  selectManualPlayer(playerId) {
    Players.selectManualPlayer(state, playerId);
    persistAndRender();
  },
  undoManualTeam(teamId) {
    Players.undoManualTeam(state, teamId);
    persistAndRender();
  },
  editManualPairing() {
    Players.startManualPairing(state);
    persistAndRender();
  },
  swapSitOut(playerId) {
    Players.setSitOutPlayer(state, playerId);
    persistAndRender();
  },
  confirmTeams() {
    state.phase = "boards";
    persistAndRender();
  },
  setBoardCount(n) {
    Store.setBoardCount(state, n);
    persistAndRender();
  },
  startTournament() {
    Store.startTournament(state);
    persistAndRender();
  },
  recordResult(matchId, winnerId) {
    recordResult(state, matchId, winnerId);
    persistAndRender();
  },
  startNewTournament() {
    state = Store.resetTournament();
    persistAndRender();
  },
  backToSetup() {
    state.phase = "setup";
    persistAndRender();
  },
  backToTeams() {
    state.phase = "teams";
    persistAndRender();
  },
};

function render() {
  switch (state.phase) {
    case "teams":
      if (state.teamsMode === "manual" && !Players.isManualPairingComplete(state)) {
        renderManualPairing(root, state, app);
      } else {
        renderTeamConfirm(root, state, app);
      }
      break;
    case "boards":
      renderBoardCount(root, state, app);
      break;
    case "live":
      renderMatchView(root, state, app);
      break;
    case "complete":
      renderChampionView(root, state, app);
      break;
    case "setup":
    default:
      renderSetupNames(root, state, app);
  }
}

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Offline install just won't be available; the app still works online.
    });
  });
}

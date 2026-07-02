// Champion screen: winner/runner-up banner + export/start-over actions.

import { el, mount } from "./render.js";
import { exportHTML, exportJSON } from "../export.js";

function teamLabel(state, id) {
  const t = state.teams.find((team) => team.id === id);
  return t ? t.name : "TBD";
}

export function renderChampionView(root, state, app) {
  const gf1 = state.matches[state.grandFinal.game1MatchId];
  const gf2 = state.matches[state.grandFinal.resetMatchId];
  const decisive = gf2.status === "complete" ? gf2 : gf1;
  const runnerUpId = decisive.loserId;

  const screen = el("div", { class: "screen" }, [
    el("div", { class: "champion-banner" }, [
      el("div", { class: "trophy", text: "🏆" }),
      el("h2", { text: teamLabel(state, state.championTeamId) }),
      el("p", { text: `Runner-up: ${teamLabel(state, runnerUpId)}` }),
    ]),
    el("div", { class: "actions" }, [
      el("button", { class: "primary", text: "Download HTML Report", onclick: () => exportHTML(state) }),
      el("button", { text: "Download JSON Data", onclick: () => exportJSON(state) }),
      el("button", {
        class: "danger",
        text: "Start New Tournament",
        onclick: () => {
          if (window.confirm("Start a new tournament? This clears the current results.")) {
            app.startNewTournament();
          }
        },
      }),
    ]),
  ]);

  mount(root, screen);
}

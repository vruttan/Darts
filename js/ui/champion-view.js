// Champion screen: winner/runner-up banner + export/start-over actions.

import { el, mount, showConfirm } from "./render.js";
import { exportHTML, exportJSON } from "../export.js";
import { t } from "../i18n.js";

function teamLabel(state, id) {
  const team = state.teams.find((tm) => tm.id === id);
  return team ? team.name : t("tbd");
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
      el("p", { text: `${t("runnerUpLabel")} ${teamLabel(state, runnerUpId)}` }),
    ]),
    el("div", { class: "actions" }, [
      el("button", { class: "primary", text: t("downloadHtmlReport"), onclick: () => exportHTML(state) }),
      el("button", { text: t("downloadJsonData"), onclick: () => exportJSON(state) }),
      el("button", {
        class: "danger",
        text: t("startNewTournament"),
        onclick: () => {
          showConfirm(t("confirmNewTournament"), () => app.startNewTournament());
        },
      }),
    ]),
  ]);

  mount(root, screen);
}

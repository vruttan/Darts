// Champion screen: winner/runner-up banner + expanded brackets + start-over action.

import { el, mount, showConfirm } from "./render.js";
import { teamRecords } from "../util.js";
import { bracketDiagram } from "../export.js";
import { renderCompletedPanel } from "./completed-matches.js";
import { t } from "../i18n.js";

function teamLabel(state, id) {
  const team = state.teams.find((tm) => tm.id === id);
  return team ? team.name : t("tbd");
}

function renderDiagramSection(title, html) {
  if (!html) return null;
  return el("details", { class: "bracket-section", open: true }, [
    el("summary", { text: title }),
    el("div", { class: "bd-wrap", html }),
  ]);
}

export function renderChampionView(root, state, app) {
  const gf1 = state.matches[state.grandFinal.game1MatchId];
  const gf2 = state.matches[state.grandFinal.resetMatchId];
  const decisive = gf2.status === "complete" ? gf2 : gf1;
  const runnerUpId = decisive.loserId;

  const records = teamRecords(state.matches);
  const allMatches = state.matchOrder.map((id) => state.matches[id]);
  const wbMatches = allMatches.filter((m) => m.bracket === "winners");
  const lbMatches = allMatches.filter((m) => m.bracket === "losers");

  const completedMatches = (state.completedMatchIds || [])
    .slice()
    .reverse()
    .map((id) => state.matches[id])
    .filter(Boolean);

  const screen = el("div", { class: "screen" }, [
    el("div", { class: "champion-banner" }, [
      el("div", { class: "trophy", text: "🏆" }),
      el("h2", { text: teamLabel(state, state.championTeamId) }),
      el("p", { text: `${t("runnerUpLabel")} ${teamLabel(state, runnerUpId)}` }),
    ]),
    el("div", { class: "actions" }, [
      el("button", {
        class: "danger",
        text: t("startNewTournament"),
        onclick: () => {
          showConfirm(t("confirmNewTournament"), () => app.startNewTournament());
        },
      }),
    ]),
    renderDiagramSection(t("winnersBracket"), bracketDiagram(wbMatches, state, records)),
    renderDiagramSection(t("losersBracket"), bracketDiagram(lbMatches, state, records)),
    renderCompletedPanel(state, records, app, completedMatches),
  ]);

  mount(root, screen);
}

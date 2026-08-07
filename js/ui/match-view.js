// Live match queue screen: one card per board, tap a team name to record the
// winner, plus collapsible graphical bracket diagrams (same rendering as the
// HTML export) for both brackets and the grand final.

import { el, mount, showConfirm } from "./render.js";
import { teamRecords } from "../util.js";
import { exportHTML, bracketDiagram, grandFinalSection } from "../export.js";

function teamLabel(state, teamId) {
  if (teamId == null) return "TBD";
  const t = state.teams.find((team) => team.id === teamId);
  return t ? t.name : "TBD";
}

function teamDisplay(state, records, teamId) {
  if (teamId == null) return "TBD";
  const r = records[teamId] || { wins: 0, losses: 0 };
  return `${teamLabel(state, teamId)} (${r.wins}:${r.losses})`;
}

function renderDiagramSection(title, html, openByDefault) {
  if (!html) return null;
  return el("details", { class: "bracket-section", open: openByDefault }, [
    el("summary", { text: title }),
    el("div", { class: "bd-wrap", html }),
  ]);
}

function bracketLabel(bracket) {
  switch (bracket) {
    case "winners":
      return "Winners Bracket";
    case "losers":
      return "Losers Bracket";
    case "grandfinal":
      return "Grand Final";
    case "grandfinal-reset":
      return "Grand Final Reset";
    default:
      return bracket;
  }
}

function matchContextLabel(m) {
  const label = bracketLabel(m.bracket);
  return m.bracket === "grandfinal" || m.bracket === "grandfinal-reset" ? label : `${label} — Round ${m.round}`;
}

function renderCompletedCard(state, records, m) {
  const aName = teamDisplay(state, records, m.teamAId);
  const bName = teamDisplay(state, records, m.teamBId);
  return el("div", { class: "board-card complete" }, [
    el("div", { class: "board-label", text: matchContextLabel(m) }),
    el("button", {
      class: `team-tap ${m.winnerId === m.teamAId ? "winner" : "loser"}`,
      text: aName,
      disabled: true,
    }),
    el("div", { class: "vs", text: "vs" }),
    el("button", {
      class: `team-tap ${m.winnerId === m.teamBId ? "winner" : "loser"}`,
      text: bName,
      disabled: true,
    }),
  ]);
}

function renderBoardCard(state, records, app, board) {
  if (!board.matchId) {
    return el("div", { class: "board-card idle" }, [
      el("div", { class: "board-label", text: board.name }),
      el("p", { text: "Waiting for next match…" }),
    ]);
  }

  const match = state.matches[board.matchId];
  const labelPrefix =
    match.bracket === "grandfinal" ? "Grand Final — " : match.bracket === "grandfinal-reset" ? "Grand Final Reset — " : "";
  const aName = teamDisplay(state, records, match.teamAId);
  const bName = teamDisplay(state, records, match.teamBId);

  function pickWinner(teamId) {
    showConfirm(`${teamLabel(state, teamId)} won?`, () => app.recordResult(match.id, teamId));
  }

  return el("div", { class: "board-card" }, [
    el("div", { class: "board-label", text: `${labelPrefix}${board.name}` }),
    el("button", { class: "team-tap", text: aName, onclick: () => pickWinner(match.teamAId) }),
    el("div", { class: "vs", text: "vs" }),
    el("button", { class: "team-tap", text: bName, onclick: () => pickWinner(match.teamBId) }),
    match.bracket === "grandfinal-reset"
      ? el("p", { class: "waiting-strip", text: "Bracket reset — the losers-bracket champion won game 1, this match decides the tournament." })
      : null,
  ]);
}

export function renderMatchView(root, state, app) {
  const records = teamRecords(state.matches);
  const boardsGrid = el(
    "div",
    { class: "board-grid" },
    state.boards.map((board) => renderBoardCard(state, records, app, board))
  );

  const allMatches = state.matchOrder.map((id) => state.matches[id]);
  const grandFinalMatches = allMatches.filter((m) => m.bracket === "grandfinal" || m.bracket === "grandfinal-reset");
  const wbMatches = allMatches.filter((m) => m.bracket === "winners");
  const lbMatches = allMatches.filter((m) => m.bracket === "losers");
  const waitingCount = allMatches.filter((m) => m.status === "ready").length;

  const completedMatches = (state.completedMatchIds || [])
    .slice()
    .reverse()
    .map((id) => state.matches[id])
    .filter(Boolean);

  const screen = el("div", { class: "screen" }, [
    el("h1", { text: "Live Matches" }),
    el("div", { class: "actions" }, [
      el("button", { text: "Download HTML Report", onclick: () => exportHTML(state) }),
    ]),
    boardsGrid,
    waitingCount > 0
      ? el("p", { class: "waiting-strip", text: `${waitingCount} match(es) waiting for a free board.` })
      : null,
    renderDiagramSection("Winners Bracket", bracketDiagram(wbMatches, state, records), false),
    renderDiagramSection("Losers Bracket", bracketDiagram(lbMatches, state, records), false),
    grandFinalMatches.length > 0
      ? renderDiagramSection("Grand Final", grandFinalSection(state, records), true)
      : null,
    completedMatches.length > 0
      ? el("div", { class: "panel" }, [
          el("h2", { text: "Completed Matches" }),
          el(
            "div",
            { class: "board-grid" },
            completedMatches.map((m) => renderCompletedCard(state, records, m))
          ),
        ])
      : null,
  ]);

  mount(root, screen);
}

// Live match queue screen: one card per board, tap a team name to record the
// winner, plus a collapsible round-by-round listing of both brackets.

import { el, mount, showConfirm } from "./render.js";
import { teamRecords } from "../util.js";

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

function groupByRound(matches) {
  const rounds = {};
  for (const m of matches) {
    (rounds[m.round] = rounds[m.round] || []).push(m);
  }
  return rounds;
}

function matchRowLabel(state, records, m) {
  if (m.isBye) {
    const knownId = m.teamAId != null ? m.teamAId : m.teamBId;
    const label = `${teamDisplay(state, records, knownId)} — BYE`;
    return m.status === "complete" ? label : `${label} (pending)`;
  }
  const a = teamDisplay(state, records, m.teamAId);
  const b = teamDisplay(state, records, m.teamBId);
  if (m.status === "complete") {
    return `${a} vs ${b} — ${teamLabel(state, m.winnerId)} won`;
  }
  if (m.teamAId == null || m.teamBId == null) return `${a} vs ${b} (pending)`;
  if (m.status === "in-progress") return `${a} vs ${b} (Board ${m.boardNumber})`;
  return `${a} vs ${b} (waiting for a board)`;
}

function renderBracketSection(title, matches, state, records, openByDefault) {
  if (matches.length === 0) return null;
  const rounds = groupByRound(matches);
  const roundNums = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);

  const body = [];
  for (const r of roundNums) {
    body.push(el("div", { class: "round-heading", text: `Round ${r}` }));
    body.push(
      el(
        "div",
        { class: "match-list" },
        rounds[r].map((m) =>
          el("div", { class: `match-row${m.status === "complete" ? " done" : ""}`, text: matchRowLabel(state, records, m) })
        )
      )
    );
  }

  return el("details", { class: "bracket-section", open: openByDefault }, [el("summary", { text: title }), ...body]);
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
      el("div", { class: "board-label", text: `Board ${board.number}` }),
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
    el("div", { class: "board-label", text: `${labelPrefix}Board ${board.number}` }),
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
    boardsGrid,
    waitingCount > 0
      ? el("p", { class: "waiting-strip", text: `${waitingCount} match(es) waiting for a free board.` })
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
    renderBracketSection("Grand Final", grandFinalMatches, state, records, true),
    renderBracketSection("Winners Bracket", wbMatches, state, records, false),
    renderBracketSection("Losers Bracket", lbMatches, state, records, false),
  ]);

  mount(root, screen);
}

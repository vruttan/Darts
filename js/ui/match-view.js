// Live match queue screen: one card per board, tap a team name to record the
// winner, plus a collapsible round-by-round listing of both brackets.

import { el, mount, showConfirm } from "./render.js";

function teamLabel(state, teamId) {
  if (teamId == null) return "TBD";
  const t = state.teams.find((team) => team.id === teamId);
  return t ? t.name : "TBD";
}

function groupByRound(matches) {
  const rounds = {};
  for (const m of matches) {
    (rounds[m.round] = rounds[m.round] || []).push(m);
  }
  return rounds;
}

function matchRowLabel(state, m) {
  const a = teamLabel(state, m.teamAId);
  const b = teamLabel(state, m.teamBId);
  if (m.status === "complete") {
    return `${a} vs ${b} — ${teamLabel(state, m.winnerId)} won`;
  }
  if (m.teamAId == null || m.teamBId == null) return `${a} vs ${b} (pending)`;
  if (m.status === "in-progress") return `${a} vs ${b} (Board ${m.boardNumber})`;
  return `${a} vs ${b} (waiting for a board)`;
}

function renderBracketSection(title, matches, state, openByDefault) {
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
          el("div", { class: `match-row${m.status === "complete" ? " done" : ""}`, text: matchRowLabel(state, m) })
        )
      )
    );
  }

  return el("details", { class: "bracket-section", open: openByDefault }, [el("summary", { text: title }), ...body]);
}

function renderBoardCard(state, app, board) {
  if (!board.matchId) {
    return el("div", { class: "board-card idle" }, [
      el("div", { class: "board-label", text: `Board ${board.number}` }),
      el("p", { text: "Waiting for next match…" }),
    ]);
  }

  const match = state.matches[board.matchId];
  const labelPrefix =
    match.bracket === "grandfinal" ? "Grand Final — " : match.bracket === "grandfinal-reset" ? "Grand Final Reset — " : "";
  const aName = teamLabel(state, match.teamAId);
  const bName = teamLabel(state, match.teamBId);

  function pickWinner(teamId, teamName) {
    showConfirm(`${teamName} won?`, () => app.recordResult(match.id, teamId));
  }

  return el("div", { class: "board-card" }, [
    el("div", { class: "board-label", text: `${labelPrefix}Board ${board.number}` }),
    el("button", { class: "team-tap primary", text: aName, onclick: () => pickWinner(match.teamAId, aName) }),
    el("div", { class: "vs", text: "vs" }),
    el("button", { class: "team-tap", text: bName, onclick: () => pickWinner(match.teamBId, bName) }),
    match.bracket === "grandfinal-reset"
      ? el("p", { class: "waiting-strip", text: "Bracket reset — the losers-bracket champion won game 1, this match decides the tournament." })
      : null,
  ]);
}

export function renderMatchView(root, state, app) {
  const boardsGrid = el(
    "div",
    { class: "board-grid" },
    state.boards.map((board) => renderBoardCard(state, app, board))
  );

  const allMatches = state.matchOrder.map((id) => state.matches[id]);
  const grandFinalMatches = allMatches.filter((m) => m.bracket === "grandfinal" || m.bracket === "grandfinal-reset");
  const wbMatches = allMatches.filter((m) => m.bracket === "winners");
  const lbMatches = allMatches.filter((m) => m.bracket === "losers");
  const waitingCount = allMatches.filter((m) => m.status === "ready").length;

  const screen = el("div", { class: "screen" }, [
    el("h1", { text: "Live Matches" }),
    boardsGrid,
    waitingCount > 0
      ? el("p", { class: "waiting-strip", text: `${waitingCount} match(es) waiting for a free board.` })
      : null,
    renderBracketSection("Grand Final", grandFinalMatches, state, true),
    renderBracketSection("Winners Bracket", wbMatches, state, false),
    renderBracketSection("Losers Bracket", lbMatches, state, false),
  ]);

  mount(root, screen);
}

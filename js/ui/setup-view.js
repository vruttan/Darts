// Setup phase screens: name entry -> team confirmation -> board count.

import { el, mount } from "./render.js";

const MIN_PLAYERS = 4;

export function renderSetupNames(root, state, app) {
  const input = el("input", { type: "text", placeholder: "Player name", id: "player-name-input" });

  function submit() {
    if (input.value.trim()) {
      app.addPlayer(input.value);
      input.value = "";
      input.focus();
    }
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  const chips = el(
    "div",
    { class: "chip-list" },
    state.players.map((p) =>
      el("span", { class: "chip" }, [
        p.name,
        el("button", { text: "×", onclick: () => app.removePlayer(p.id) }),
      ])
    )
  );

  const remaining = Math.max(0, MIN_PLAYERS - state.players.length);

  const screen = el("div", { class: "screen" }, [
    el("h1", { text: "Darts Tournament" }),
    el("p", { class: "subtitle", text: "Enter every player's name. They'll be randomly paired into doubles teams." }),
    el("div", { class: "panel" }, [
      el("div", { class: "row" }, [input, el("button", { class: "primary", text: "+", onclick: submit })]),
      chips,
      el("p", {
        class: "waiting-strip",
        text:
          state.players.length === 0
            ? "No players yet."
            : remaining > 0
              ? `${state.players.length} player(s) entered — add ${remaining} more (minimum ${MIN_PLAYERS}).`
              : `${state.players.length} player(s) entered.`,
      }),
    ]),
    el("div", { class: "actions" }, [
      el("button", {
        class: "primary",
        text: "Next: Form Teams",
        disabled: state.players.length < MIN_PLAYERS,
        onclick: () => app.goToTeams(),
      }),
    ]),
  ]);

  mount(root, screen);
  input.focus();
}

export function renderTeamConfirm(root, state, app) {
  const sitOut = state.players.find((p) => p.sittingOut);

  const banner = sitOut
    ? el("div", { class: "banner" }, [
      el("p", { text: `${sitOut.name} sits out this tournament (odd number of players).` }),
      el(
        "select",
        {
          onchange: (e) => {
            if (e.target.value) app.swapSitOut(e.target.value);
          },
        },
        [
          el("option", { value: "", text: "Choose a different player to sit out…" }),
          ...state.players
            .filter((p) => !p.sittingOut)
            .map((p) => el("option", { value: p.id, text: p.name })),
        ]
      ),
    ])
    : null;

  const teamCards = state.teams.map((t) => el("div", { class: "team-card", text: t.name }));

  const screen = el("div", { class: "screen" }, [
    el("h1", { text: "Confirm Teams" }),
    banner,
    el("div", { class: "panel" }, [
      el("h2", { text: `${state.teams.length} Teams` }),
      el("div", { class: "chip-list", style: "flex-direction:column;align-items:stretch;" }, teamCards),
    ]),
    el("div", { class: "actions" }, [
      el("button", { text: "Re-shuffle Teams", onclick: () => app.reshuffleTeams() }),
      el("button", { class: "primary", text: "Confirm Teams", onclick: () => app.confirmTeams() }),
      el("button", { class: "link", text: "← Back to Players", onclick: () => app.backToSetup() }),
    ]),
  ]);

  mount(root, screen);
}

export function renderBoardCount(root, state, app) {
  const valueLabel = el("span", { class: "value", text: String(state.boardCount) });

  function setCount(n) {
    app.setBoardCount(Math.max(1, Math.min(5, n)));
  }

  const screen = el("div", { class: "screen" }, [
    el("h1", { text: "Dart Boards" }),
    el("p", { class: "subtitle", text: "How many boards are available? Matches will be assigned to boards automatically as they free up." }),
    el("div", { class: "panel" }, [
      el("div", { class: "stepper" }, [
        el("button", { text: "−", onclick: () => setCount(state.boardCount - 1) }),
        valueLabel,
        el("button", { text: "+", onclick: () => setCount(state.boardCount + 1) }),
      ]),
    ]),
    el("div", { class: "actions" }, [
      el("button", { class: "primary", text: "Start Tournament", onclick: () => app.startTournament() }),
      el("button", { class: "link", text: "← Back to Teams", onclick: () => app.backToTeams() }),
    ]),
  ]);

  mount(root, screen);
}

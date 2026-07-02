// Client-side only export: HTML report + JSON data dump, via Blob + anchor
// download. No server involved.

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportJSON(state) {
  downloadBlob(JSON.stringify(state, null, 2), "darts-tournament-results.json", "application/json");
}

function teamLabel(state, id) {
  const t = state.teams.find((team) => team.id === id);
  return t ? t.name : "TBD";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function matchRow(state, m) {
  const a = escapeHtml(teamLabel(state, m.teamAId));
  const b = escapeHtml(teamLabel(state, m.teamBId));
  const winner = m.winnerId ? escapeHtml(teamLabel(state, m.winnerId)) : "";
  return `<tr><td>${m.round}</td><td>${a}</td><td>${b}</td><td>${winner}</td></tr>`;
}

function bracketTable(title, matches, state) {
  if (matches.length === 0) return "";
  const rows = matches.map((m) => matchRow(state, m)).join("");
  return `<h2>${title}</h2><table><thead><tr><th>Round</th><th>Team A</th><th>Team B</th><th>Winner</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function exportHTML(state) {
  const gf1 = state.matches[state.grandFinal.game1MatchId];
  const gf2 = state.matches[state.grandFinal.resetMatchId];
  const decisive = gf2.status === "complete" ? gf2 : gf1;
  const runnerUpId = decisive.loserId;

  const championName = escapeHtml(teamLabel(state, state.championTeamId));
  const runnerUpName = escapeHtml(teamLabel(state, runnerUpId));

  const teamsRows = state.teams
    .map((t) => {
      const names = t.playerIds
        .map((id) => escapeHtml(state.players.find((p) => p.id === id)?.name || "?"))
        .join(" & ");
      return `<tr><td>${escapeHtml(t.name)}</td><td>${names}</td></tr>`;
    })
    .join("");

  const allMatches = state.matchOrder.map((id) => state.matches[id]);
  const wb = allMatches.filter((m) => m.bracket === "winners");
  const lb = allMatches.filter((m) => m.bracket === "losers");
  const gf = allMatches
    .filter((m) => m.bracket === "grandfinal" || m.bracket === "grandfinal-reset")
    .filter((m) => m.status === "complete");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Darts Tournament Results</title>
<style>
body{font-family:Arial,sans-serif;background:#111;color:#eee;padding:24px;max-width:800px;margin:0 auto;}
h1{color:#2e9e5b;}
table{width:100%;border-collapse:collapse;margin-bottom:24px;}
th,td{border:1px solid #444;padding:8px;text-align:left;}
th{background:#222;}
.banner{background:#1c1c1c;border:1px solid #2e9e5b;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px;}
</style>
</head>
<body>
<h1>Darts Tournament Results</h1>
<div class="banner">
  <p>&#127942; Champion: <strong>${championName}</strong></p>
  <p>Runner-up: ${runnerUpName}</p>
</div>
<h2>Teams</h2>
<table><thead><tr><th>Team</th><th>Players</th></tr></thead><tbody>${teamsRows}</tbody></table>
${bracketTable("Winners Bracket", wb, state)}
${bracketTable("Losers Bracket", lb, state)}
${bracketTable("Grand Final", gf, state)}
<p>Generated ${new Date().toLocaleString()}</p>
</body>
</html>`;

  downloadBlob(html, "darts-tournament-results.html", "text/html");
}

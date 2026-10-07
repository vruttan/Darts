// Plain assert-based test harness for state.js's localStorage persistence.
// Same style as tests/bracket.test.js: run with `node tests/state.test.js`.
// Node has no localStorage, so a minimal in-memory stand-in is installed
// before state.js is imported.

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { createInitialState, save, load, BACKUP_KEY } = await import("../js/state.js");

const STORAGE_KEY = "darts-tournament-state";

let passCount = 0;
let failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function test(name, fn) {
  store.clear();
  try {
    fn();
    passCount++;
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
  }
}

test("save/load round-trips a current-version state", () => {
  const state = createInitialState();
  state.boardNames.push("Board A");
  save(state);
  const loaded = load();
  assert(loaded && loaded.boardNames[0] === "Board A", "loaded state should match saved state");
  assert(store.get(BACKUP_KEY) == null, "no backup should be written for a valid state");
});

test("a schema-version mismatch is backed up, not silently destroyed", () => {
  const old = JSON.stringify({ version: 1, phase: "live", teams: [{ id: "t-1" }] });
  store.set(STORAGE_KEY, old);
  assert(load() === null, "mismatched version should not load");
  assert(store.get(BACKUP_KEY) === old, "original blob should be copied to the backup key");
});

test("unparseable saved state is backed up", () => {
  store.set(STORAGE_KEY, "{not json");
  assert(load() === null, "corrupt state should not load");
  assert(store.get(BACKUP_KEY) === "{not json", "corrupt blob should be copied to the backup key");
});

test("a new initial state has completedAt unset", () => {
  assert(createInitialState().completedAt === null, "completedAt should start null");
});

// ---- Report ----
console.log(`${passCount} passed, ${failures.length} failed`);
for (const f of failures) console.log(`FAIL: ${f}`);
if (failures.length > 0) process.exit(1);

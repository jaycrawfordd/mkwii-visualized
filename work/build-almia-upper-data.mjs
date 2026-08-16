import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { almiaUpperTournament as tournament } from "./almia-upper-tournament.mjs";

const root = new URL("../", import.meta.url);
const statePath = new URL("work/current-ladders.json", root);
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const ladderId = Number(process.env.MKW_CURRENT_RT_LADDER_ID || state.rt || 19);
const leaderboardPath = new URL(`work/csv/leaderboard_ladder_id_${ladderId}.csv`, root);
const eventsPath = new URL(`work/csv/events_ladder_id_${ladderId}.csv`, root);
const dashboardPath = new URL("public/dashboard-data.json", root);
const outputPath = new URL("public/almia-upper-data.json", root);

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { fields.push(field); field = ""; }
    else field += char;
  }
  fields.push(field);
  return fields;
}

function parseCsv(path) {
  const lines = readFileSync(path, "utf8").trimEnd().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, fields[index] || ""]));
  });
}

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const normalize = (value) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
const average = (values) => {
  const present = values.filter(Number.isFinite);
  return present.length ? Math.round(present.reduce((sum, value) => sum + value, 0) / present.length) : null;
};
const divisionForLr = (lr) => {
  if (lr >= 14000) return "Grandmaster"; if (lr >= 13000) return "Master";
  if (lr >= 11000) return "Diamond"; if (lr >= 9500) return "Ruby";
  if (lr >= 8250) return "Emerald"; if (lr >= 7000) return "Platinum";
  if (lr >= 5500) return "Gold"; if (lr >= 4000) return "Silver";
  if (lr >= 2500) return "Bronze"; if (lr >= 1250) return "Copper"; return "Iron";
};
const expectedStage = (seed) => seed <= 12 ? [4, "Final"] : seed <= 24 ? [3, "Semifinal"] : seed <= 48 ? [2, "Round 2"] : [1, "Round 1"];
const currentNameAliases = new Map([
  ["Edwin", "EdwinLP"],
  ["pttmxrx", "veil"],
]);

const leaderboard = parseCsv(leaderboardPath);
const byName = new Map(leaderboard.map((row) => [normalize(row.player_name), row]));
const identities = new Map();
const unmatched = [];
for (const name of tournament.registeredPlayers) {
  const row = byName.get(normalize(currentNameAliases.get(name) || name));
  if (!row) { unmatched.push(name); continue; }
  identities.set(name, { id: row.player_id, sourceName: row.player_name, profileUrl: row.url, peakMmr: number(row.peak_mmr), peakLr: number(row.peak_lr) });
}

const cutoffMs = Date.parse(tournament.ratingCutoff);
const snapshots = new Map(leaderboard.map((row) => [row.player_id, { mmr: number(row.base_mmr), lr: number(row.base_lr), dateMs: -Infinity, eventDate: null }]));
const stream = createInterface({ input: createReadStream(eventsPath), crlfDelay: Infinity });
let headers = null;
for await (const line of stream) {
  if (!headers) { headers = parseCsvLine(line); continue; }
  if (!line) continue;
  const fields = parseCsvLine(line);
  if (fields.length !== headers.length) continue;
  const row = Object.fromEntries(headers.map((header, index) => [header, fields[index] || ""]));
  const dateMs = Date.parse(`${row.event_date.replace(" ", "T")}Z`);
  if (!Number.isFinite(dateMs) || dateMs > cutoffMs || !snapshots.has(row.player_id)) continue;
  const current = snapshots.get(row.player_id);
  if (dateMs >= current.dateMs) snapshots.set(row.player_id, { mmr: number(row.updated_mmr, current.mmr), lr: number(row.updated_lr, current.lr), dateMs, eventDate: row.event_date });
}

const ranked = leaderboard.map((row) => ({ id: row.player_id, mmr: snapshots.get(row.player_id)?.mmr ?? number(row.base_mmr) })).sort((a, b) => b.mmr - a.mmr || number(a.id) - number(b.id));
const rankById = new Map(ranked.map((row, index) => [row.id, index + 1]));
const dashboard = JSON.parse(readFileSync(dashboardPath, "utf8"));
const gmById = new Map((dashboard.grandmastersByTrack?.rt || []).map((row) => [row.id, row]));
const roundByPlayer = new Map();
const scoreByRoundPlayer = new Map();
for (const round of tournament.rounds) for (const room of round.rooms) room.results.forEach(([name, score], index) => {
  roundByPlayer.set(name, Math.max(roundByPlayer.get(name) || 0, round.round));
  scoreByRoundPlayer.set(`${round.round}:${name}`, { score, place: index + 1 });
});

const competedNames = new Set(tournament.rounds[0].rooms.flatMap((room) => room.results.map(([name]) => name)));
const unmatchedCompetitors = unmatched.filter((name) => competedNames.has(name));
const players = tournament.registeredPlayers.map((name) => {
  const identity = identities.get(name);
  const snapshot = identity ? snapshots.get(identity.id) : null;
  const maxRound = roundByPlayer.get(name) || 0;
  const final = scoreByRoundPlayer.get(`4:${name}`);
  const lastResult = scoreByRoundPlayer.get(`${maxRound}:${name}`);
  return { name, id: identity?.id || null, sourceName: identity?.sourceName || null, competed: competedNames.has(name), mmr: snapshot?.mmr ?? null, lr: snapshot?.lr ?? null, rank: identity ? rankById.get(identity.id) || null : null, division: snapshot ? divisionForLr(snapshot.lr) : "Unmatched", ratingEventDate: snapshot?.eventDate || null, peakMmr: identity?.peakMmr ?? null, peakLr: identity?.peakLr ?? null, profileUrl: identity?.profileUrl || null, maxRound, result: final ? `Final #${final.place}` : maxRound ? tournament.rounds[maxRound - 1].label : "DNS", finalPlace: final?.place || null, finalScore: final?.score ?? null, lastScore: lastResult?.score ?? null, lastRoomPlace: lastResult?.place ?? null, allTimeGrandmaster: identity ? gmById.has(identity.id) : false };
});

const competitorsByMmr = players.filter((player) => player.competed && Number.isFinite(player.mmr)).sort((a, b) => b.mmr - a.mmr || a.name.localeCompare(b.name));
const seedByName = new Map(competitorsByMmr.map((player, index) => [player.name, index + 1]));
for (const player of players) {
  player.mmrSeed = seedByName.get(player.name) || null;
  const [level, label] = player.mmrSeed ? expectedStage(player.mmrSeed) : [0, "Unrated"];
  player.expectedResult = label;
  player.stageDelta = player.competed && player.mmrSeed ? player.maxRound - level : 0;
}

const tournamentOrder = [...players].sort((a, b) => {
  if (a.finalPlace && b.finalPlace) return a.finalPlace - b.finalPlace;
  if (a.finalPlace) return -1;
  if (b.finalPlace) return 1;
  return b.maxRound - a.maxRound
    || (b.lastScore ?? -Infinity) - (a.lastScore ?? -Infinity)
    || (a.lastRoomPlace ?? Infinity) - (b.lastRoomPlace ?? Infinity)
    || (a.mmrSeed ?? Infinity) - (b.mmrSeed ?? Infinity)
    || a.name.localeCompare(b.name);
});
tournamentOrder.forEach((player, index) => { player.overallPlace = index + 1; });

const roomDifficulty = tournament.rounds.flatMap((round) => round.rooms.map((room) => {
  const roomPlayers = room.results.map(([name, score], index) => { const player = players.find((candidate) => candidate.name === name); return { name, score, place: index + 1, mmr: player?.mmr ?? null, rank: player?.rank ?? null }; });
  return { id: `r${round.round}-room-${room.room}`, round: round.round, roundLabel: round.label, room: room.room, host: room.host, format: round.format, averageMmr: average(roomPlayers.map((player) => player.mmr)), averageRank: average(roomPlayers.map((player) => player.rank)), matchedPlayers: roomPlayers.filter((player) => Number.isFinite(player.mmr)).length, playerCount: roomPlayers.length, players: roomPlayers };
})).sort((a, b) => (b.averageMmr || 0) - (a.averageMmr || 0));
roomDifficulty.forEach((room, index) => { room.difficultyRank = index + 1; });

const roundStrength = tournament.rounds.map((round) => {
  const names = [...new Set(round.rooms.flatMap((room) => room.results.map(([name]) => name)))];
  const rows = names.map((name) => players.find((player) => player.name === name)).filter(Boolean);
  return { round: round.round, label: round.label, playerCount: names.length, averageMmr: average(rows.map((player) => player.mmr)), averageLr: average(rows.map((player) => player.lr)) };
});
const divisionOrder = ["Iron", "Copper", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Ruby", "Diamond", "Master", "Grandmaster"];
const rankDistribution = divisionOrder.map((division) => ({ division, value: players.filter((player) => player.competed && player.division === division).length }));
const topRankCounts = [10, 25, 50, 100].map((threshold) => ({ threshold, value: players.filter((player) => player.competed && player.rank && player.rank <= threshold).length }));
const outperformers = players.filter((player) => player.competed && player.stageDelta > 0).sort((a, b) => b.stageDelta - a.stageDelta || b.maxRound - a.maxRound || (a.mmrSeed || 999) - (b.mmrSeed || 999));
const grandmasters = players.filter((player) => player.competed && player.allTimeGrandmaster).map((player) => ({ ...player, ...(gmById.get(player.id) || {}) })).sort((a, b) => (b.peakMmr || 0) - (a.peakMmr || 0));
const finalPlayers = players.filter((player) => player.finalPlace).sort((a, b) => a.finalPlace - b.finalPlace);
const sortedPlayers = [...players].sort((a, b) => Number.isFinite(a.mmr) && Number.isFinite(b.mmr) ? b.mmr - a.mmr : Number.isFinite(a.mmr) ? -1 : Number.isFinite(b.mmr) ? 1 : a.name.localeCompare(b.name));

writeFileSync(outputPath, JSON.stringify({
  meta: { name: tournament.name, date: tournament.date, ladderId, ratingCutoff: tournament.ratingCutoff, generatedAt: new Date().toISOString(), methodology: "MMR and LR are reconstructed from each player's latest RT event state at or before the fixed cutoff. Expected advancement is seeded by cutoff MMR.", unmatched: unmatchedCompetitors },
  summary: { registeredPlayers: tournament.registeredPlayers.length, competitors: competedNames.size, rooms: roomDifficulty.length, rounds: tournament.rounds.length, winner: finalPlayers[0]?.name || null, winnerScore: finalPlayers[0]?.finalScore || null, fieldAverageMmr: average(players.filter((player) => player.competed).map((player) => player.mmr)), matchedPlayers: players.filter((player) => player.competed && Number.isFinite(player.mmr)).length, allTimeGrandmasters: grandmasters.length },
  topRankCounts, roomDifficulty, rankDistribution, roundStrength, outperformers, grandmasters, finalPlayers, players: sortedPlayers,
}, null, 2));
console.log(`Wrote ${outputPath.pathname}`);
if (unmatchedCompetitors.length) console.warn(`Unmatched tournament competitors: ${unmatchedCompetitors.join(", ")}`);

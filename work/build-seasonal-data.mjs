import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const root = new URL("../", import.meta.url);
const csvRoot = new URL("work/csv/", root);
const outputPath = new URL("public/seasonal-data.json", root);
const banPath = new URL("work/player-bans.txt", root);
const statePath = new URL("work/current-ladders.json", root);
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const maxLadderId = Number(process.env.MKW_MAX_LADDER_ID || state.maxLadderId || 20);
const currentLadders = { rt: Number(state.rt || 19), ct: Number(state.ct || 20) };
const ladderIds = Array.from({ length: maxLadderId }, (_, index) => index + 1);

const trackFor = (ladderId) => ladderId % 2 === 1 ? "rt" : "ct";
const trackLabel = (track) => track.toUpperCase();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sqlDate = (value) => new Date(`${value.replace(" ", "T")}Z`);
const eventUrl = (eventId, ladderId) => `https://www.mkwlounge.gg/ladder/table.php?event_id=${eventId}&ladder_id=${ladderId}`;
const profileUrl = (playerId, ladderId) => `https://www.mkwlounge.gg/ladder/player.php?player_id=${playerId}&ladder_id=${ladderId}`;

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

function pushTop(list, row, compare, limit = 20) {
  list.push(row);
  list.sort(compare);
  if (list.length > limit) list.length = limit;
}

function parseBanDate(value) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  const yearOnly = /^\d{4}$/.test(cleaned);
  const monthOnly = /^[A-Za-z]+\s+\d{4}$/.test(cleaned);
  const parsed = new Date(`${yearOnly ? `1 Jan ${cleaned}` : monthOnly ? `1 ${cleaned}` : cleaned} 00:00:00 UTC`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return { iso: parsed.toISOString().slice(0, 10), precision: yearOnly ? "year" : monthOnly ? "month" : "day", label: cleaned };
}

function parseBans() {
  const raw = readFileSync(banPath, "utf8")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/\blayer:\s*Madani/, "Player: Madani");
  const bans = [];
  const seen = new Set();
  for (const chunk of raw.split(/Player:\s*/).slice(1)) {
    const firstLine = chunk.split(/\r?\n/)[0].trim();
    const match = firstLine.match(/^(.*?)\s+Date:\s*(.*?)\s+Length:\s*(.*?)\s+Reason:\s*(.*?)(?:\s+Edited)?$/i);
    if (!match) continue;
    const date = parseBanDate(match[2]);
    if (!date) continue;
    const row = { player: match[1].trim(), date: date.iso, dateLabel: date.label, datePrecision: date.precision, length: match[3].trim(), reason: match[4].trim() };
    const key = `${row.player.toLowerCase()}|${row.date}|${row.length.toLowerCase()}|${row.reason.toLowerCase()}`;
    if (!seen.has(key)) { seen.add(key); bans.push(row); }
  }
  return bans.sort((a, b) => a.date.localeCompare(b.date) || a.player.localeCompare(b.player));
}

const leaderboards = new Map();
const previousPeak = { rt: new Map(), ct: new Map() };
for (const ladderId of ladderIds) {
  const track = trackFor(ladderId);
  const rows = parseCsv(new URL(`leaderboard_ladder_id_${ladderId}.csv`, csvRoot));
  const leaderboard = rows
    .filter((row) => number(row.ranking) > 0)
    .map((row) => {
      const priorPeak = previousPeak[track].get(row.player_id) || 0;
      const peakMmr = number(row.peak_mmr);
      return {
        id: row.player_id,
        name: row.player_name || `Player ${row.player_id}`,
        rank: number(row.ranking),
        mmr: number(row.current_mmr),
        lr: number(row.current_lr),
        peakMmr,
        peakLr: number(row.peak_lr),
        events: number(row.total_events),
        wins: number(row.wins),
        losses: number(row.loss),
        winRate: Number((number(row.win_percentage) * 100).toFixed(1)),
        averageScore: Number(number(row.average_score).toFixed(1)),
        topScore: number(row.top_score),
        division: row.current_division || "Unranked",
        previousPeakMmr: priorPeak || null,
        newPeakGain: priorPeak > 0 ? Math.max(0, peakMmr - priorPeak) : 0,
        url: row.url || profileUrl(row.player_id, ladderId),
      };
    })
    .sort((a, b) => a.rank - b.rank || b.mmr - a.mmr);
  leaderboards.set(ladderId, leaderboard);
  for (const row of rows) {
    previousPeak[track].set(row.player_id, Math.max(previousPeak[track].get(row.player_id) || 0, number(row.peak_mmr), number(row.current_mmr)));
  }
}

async function buildSeason(ladderId) {
  const track = trackFor(ladderId);
  const leaderboard = leaderboards.get(ladderId) || [];
  const names = new Map(leaderboard.map((row) => [row.id, row.name]));
  const stats = new Map();
  const divisionHits = new Map();
  const teammateCounts = new Map();
  const largestMmrGains = [];
  const largestMmrLosses = [];
  const largestLrGains = [];
  const largestLrLosses = [];
  const eventIds = new Set();
  let startMs = Infinity;
  let endMs = -Infinity;
  let headers = null;
  let activeEventId = null;
  let activeEventRows = [];

  function playerName(id, fallback) {
    return names.get(id) || fallback || `Player ${id}`;
  }

  function closeEvent() {
    if (!activeEventRows.length) return;
    const teams = new Map();
    for (const row of activeEventRows) {
      if (!row.team) continue;
      if (!teams.has(row.team)) teams.set(row.team, []);
      if (!teams.get(row.team).some((player) => player.id === row.playerId)) teams.get(row.team).push({ id: row.playerId, name: row.name });
    }
    for (const teammates of teams.values()) {
      if (teammates.length < 2) continue;
      for (let left = 0; left < teammates.length; left += 1) for (let right = left + 1; right < teammates.length; right += 1) {
        const pair = [teammates[left], teammates[right]].sort((a, b) => number(a.id) - number(b.id));
        const key = `${pair[0].id}:${pair[1].id}`;
        const existing = teammateCounts.get(key) || { playerA: pair[0], playerB: pair[1], events: 0 };
        existing.events += 1;
        teammateCounts.set(key, existing);
      }
    }
    activeEventRows = [];
  }

  const stream = createInterface({ input: createReadStream(new URL(`events_ladder_id_${ladderId}.csv`, csvRoot)), crlfDelay: Infinity });
  for await (const line of stream) {
    if (!headers) { headers = parseCsvLine(line); continue; }
    if (!line) continue;
    const fields = parseCsvLine(line);
    if (fields.length !== headers.length) continue;
    const row = Object.fromEntries(headers.map((header, index) => [header, fields[index] || ""]));
    const date = sqlDate(row.event_date);
    const dateMs = date.getTime();
    if (!Number.isFinite(dateMs)) continue;
    const id = row.player_id;
    const name = playerName(id, row.player_name);
    const eventId = row.event_id;
    const currentMmr = number(row.current_mmr);
    const updatedMmr = number(row.updated_mmr);
    const currentLr = number(row.current_lr);
    const updatedLr = number(row.updated_lr);
    const changeMmr = number(row.change_mmr);
    const changeLr = number(row.change_lr);
    const event = { id, name, value: changeMmr, lrValue: changeLr, score: number(row.score), date: row.event_date.slice(0, 10), eventId, url: eventUrl(eventId, ladderId) };
    startMs = Math.min(startMs, dateMs);
    endMs = Math.max(endMs, dateMs);
    eventIds.add(eventId);

    const player = stats.get(id) || { id, name, firstMs: dateMs, lastMs: dateMs, startMmr: currentMmr, endMmr: updatedMmr, startLr: currentLr, endLr: updatedLr, events: 0, wins: 0, scoreSum: 0, peakMmr: Math.max(currentMmr, updatedMmr), peakLr: Math.max(currentLr, updatedLr) };
    if (dateMs < player.firstMs) { player.firstMs = dateMs; player.startMmr = currentMmr; player.startLr = currentLr; }
    if (dateMs >= player.lastMs) { player.lastMs = dateMs; player.endMmr = updatedMmr; player.endLr = updatedLr; }
    player.events += 1;
    player.wins += number(row.ranking) === 1 ? 1 : 0;
    player.scoreSum += number(row.score);
    player.peakMmr = Math.max(player.peakMmr, currentMmr, updatedMmr);
    player.peakLr = Math.max(player.peakLr, currentLr, updatedLr);
    stats.set(id, player);

    for (const division of [row.current_division, row.updated_division]) {
      if (!division || !["Master", "Grandmaster"].includes(division)) continue;
      const key = `${id}:${division}`;
      const existing = divisionHits.get(key);
      if (!existing || dateMs < existing.dateMs) divisionHits.set(key, { id, name, division, date: row.event_date.slice(0, 10), dateMs, mmr: Math.max(currentMmr, updatedMmr), lr: Math.max(currentLr, updatedLr), url: event.url });
    }

    pushTop(largestMmrGains, event, (a, b) => b.value - a.value || b.score - a.score);
    pushTop(largestMmrLosses, event, (a, b) => a.value - b.value || a.score - b.score);
    pushTop(largestLrGains, { ...event, value: changeLr }, (a, b) => b.value - a.value || b.score - a.score);
    pushTop(largestLrLosses, { ...event, value: changeLr }, (a, b) => a.value - b.value || a.score - b.score);

    if (activeEventId !== eventId) { closeEvent(); activeEventId = eventId; }
    activeEventRows.push({ playerId: id, name, team: number(row.team) });
  }
  closeEvent();

  const movement = [...stats.values()].map((row) => ({ ...row, mmrChange: row.endMmr - row.startMmr, lrChange: row.endLr - row.startLr, averageScore: Number((row.scoreSum / Math.max(1, row.events)).toFixed(1)), url: profileUrl(row.id, ladderId) }));
  const greatestGains = [...movement].sort((a, b) => b.mmrChange - a.mmrChange || b.lrChange - a.lrChange).slice(0, 20);
  const greatestFalls = [...movement].sort((a, b) => a.mmrChange - b.mmrChange || a.lrChange - b.lrChange).slice(0, 20);
  const improvements = leaderboard.filter((row) => row.newPeakGain > 0).sort((a, b) => b.newPeakGain - a.newPeakGain || b.peakMmr - a.peakMmr).slice(0, 20);
  const mostEvents = [...movement].sort((a, b) => b.events - a.events || b.wins - a.wins).slice(0, 40);
  const teammatePairs = [...teammateCounts.values()].sort((a, b) => b.events - a.events || a.playerA.name.localeCompare(b.playerA.name)).slice(0, 20);
  const rankOrder = ["Iron", "Copper", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Ruby", "Diamond", "Master", "Grandmaster", "Unranked"];
  const rankDistribution = rankOrder.map((division) => ({ division, value: leaderboard.filter((row) => row.division === division).length }));
  const previousLeaderboard = leaderboards.get(ladderId - 2) || [];
  const previousById = new Map(previousLeaderboard.map((row) => [row.id, row]));
  const endToEnd = leaderboard.filter((row) => previousById.has(row.id)).map((row) => ({ id: row.id, name: row.name, previousMmr: previousById.get(row.id).mmr, currentMmr: row.mmr, value: row.mmr - previousById.get(row.id).mmr, url: row.url })).sort((a, b) => b.value - a.value);

  return {
    meta: { ladderId, track, label: `${trackLabel(track)} S${ladderId}`, current: currentLadders[track] === ladderId, start: new Date(startMs).toISOString().slice(0, 10), end: new Date(endMs).toISOString().slice(0, 10), eventCount: eventIds.size, playerCount: leaderboard.length, sourceUrl: `https://www.mkwlounge.gg/ladder/index.php?ladder_id=${ladderId}&hide_unranked=0` },
    summary: { champion: leaderboard[0] || null, averageMmr: Math.round(leaderboard.reduce((sum, row) => sum + row.mmr, 0) / Math.max(1, leaderboard.length)), totalEntries: movement.reduce((sum, row) => sum + row.events, 0), uniqueCompetitors: movement.length },
    leaderboard,
    improvements,
    greatestGains,
    greatestFalls,
    endToEndGains: endToEnd.slice(0, 20),
    endToEndFalls: endToEnd.slice(-20).reverse(),
    mostEvents,
    divisionHits: [...divisionHits.values()].sort((a, b) => b.division.localeCompare(a.division) || a.date.localeCompare(b.date)),
    largestMmrGains,
    largestMmrLosses,
    largestLrGains,
    largestLrLosses,
    teammatePairs,
    rankDistribution,
    extraRecords: {
      mostWins: [...movement].sort((a, b) => b.wins - a.wins || b.events - a.events).slice(0, 10),
      bestAverageScore: [...movement].filter((row) => row.events >= (track === "rt" ? 30 : 15)).sort((a, b) => b.averageScore - a.averageScore || b.events - a.events).slice(0, 10),
    },
  };
}

const bans = parseBans();
const seasons = [];
for (const ladderId of ladderIds) {
  console.log(`building seasonal ${trackLabel(trackFor(ladderId))} S${ladderId}`);
  seasons.push(await buildSeason(ladderId));
}
for (const season of seasons) {
  season.bans = bans.filter((ban) => ban.date >= season.meta.start && ban.date <= season.meta.end);
}

writeFileSync(outputPath, JSON.stringify({
  meta: { generatedAt: new Date().toISOString(), currentLadders, note: "Season boundaries come from each ladder's first and last exported event. Ban entries are a static supplied log; early unbans may not be represented." },
  seasons,
}, null, 2));
console.log(`Wrote ${outputPath.pathname}`);

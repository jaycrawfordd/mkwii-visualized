import { createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";

const root = new URL("../", import.meta.url);
const csvRoot = new URL("work/csv/", root);
const outputPath = new URL("public/dashboard-data.json", root);
const generatedLaddersPath = new URL("app/generated-ladders.ts", root);
const statePath = new URL("work/current-ladders.json", root);
const discovered = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const MAX_LADDER_ID = Number(process.env.MKW_MAX_LADDER_ID || discovered.maxLadderId || 20);
const CURRENT_LADDER_BY_TRACK = {
  rt: Number(process.env.MKW_CURRENT_RT_LADDER_ID || discovered.rt || 19),
  ct: Number(process.env.MKW_CURRENT_CT_LADDER_ID || discovered.ct || 20),
};
const LADDER_IDS = Array.from({ length: MAX_LADDER_ID }, (_, index) => index + 1);
const RT_GM_THRESHOLD = 14000;

function ladderType(ladderId) {
  return ladderId % 2 === 1 ? "rt" : "ct";
}

function trackLabel(type) {
  return type === "rt" ? "RT" : "CT";
}

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }

  fields.push(field);
  return fields;
}

function parseSmallCsv(path) {
  const lines = readFileSync(path, "utf8").trimEnd().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ""]));
  });
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateFromSql(value) {
  return new Date(`${value.replace(" ", "T")}Z`);
}

function daysBetween(a, b) {
  return Math.max(0, (b.getTime() - a.getTime()) / 86400000);
}

function fmtDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function compactDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function pushLimited(list, item, compare, limit = 20) {
  list.push(item);
  list.sort(compare);
  if (list.length > limit) {
    list.length = limit;
  }
}

function createBucket(type) {
  return {
    type,
    label: trackLabel(type),
    currentLadderId: CURRENT_LADDER_BY_TRACK[type],
    players: [],
    currentProfiles: new Map(),
    currentPlayerEvents: new Map(),
    eventCounts: new Map(),
    byPlayerEvents: new Map(),
    topScores: [],
    lowScores: [],
    biggestGains: [],
    biggestLosses: [],
    topScoresByRace: {
      12: [],
      32: [],
    },
    lowScoresByRace: {
      12: [],
      32: [],
    },
    volumeByMonth: new Map(),
    volumeByYear: new Map(),
    seasonRanges: new Map(),
    rankOneByPlayer: new Map(),
    rankOneSegments: [],
    eventCount: 0,
    totalPlayerEntries: 0,
    scoreSum: 0,
    scoreCount: 0,
    earliestEvent: null,
    latestEvent: null,
  };
}

const buckets = {
  rt: createBucket("rt"),
  ct: createBucket("ct"),
};

const players = new Map();
const loadedLadders = [];
const grandmasterMaps = {
  rt: new Map(),
  ct: new Map(),
};

function noteGrandmaster(trackType, { id, name, ladderId, mmr, lr = 0, date = null, method }) {
  const map = grandmasterMaps[trackType];
  const existing = map.get(id);
  const candidateDate = date ? date.getTime() : Infinity;
  const existingDate = existing?.firstHitMs ?? Infinity;

  if (!existing) {
    map.set(id, {
      id,
      name,
      firstHit: date ? fmtDate(date) : "Season export",
      firstHitMs: candidateDate,
      firstSeason: ladderId,
      peakMmr: mmr,
      peakLr: lr,
      evidence: method,
      url: `https://www.mkwlounge.gg/ladder/player.php?player_id=${id}&ladder_id=${ladderId}`,
    });
    return;
  }

  existing.name = name || existing.name;
  existing.peakMmr = Math.max(existing.peakMmr, mmr);
  existing.peakLr = Math.max(existing.peakLr, lr);
  if (candidateDate < existingDate) {
    existing.firstHit = date ? fmtDate(date) : "Season export";
    existing.firstHitMs = candidateDate;
    existing.firstSeason = ladderId;
    existing.evidence = method;
    existing.url = `https://www.mkwlounge.gg/ladder/player.php?player_id=${id}&ladder_id=${ladderId}`;
  }
}

function playerModelFromRow(player, ladderId, type) {
  return {
    id: player.player_id,
    name: player.player_name || `Player ${player.player_id}`,
    country: player.player_country_flag || "un",
    controller: player.game_controller || "",
    currentMmr: number(player.current_mmr),
    currentLr: number(player.current_lr),
    peakMmr: number(player.peak_mmr),
    peakLr: number(player.peak_lr),
    lowestMmr: number(player.lowest_mmr),
    lowestLr: number(player.lowest_lr),
    ranking: number(player.ranking, 0),
    percentile: number(player.percentile),
    totalEvents: number(player.total_events),
    wins: number(player.wins),
    losses: number(player.loss),
    winPercentage: number(player.win_percentage),
    maxGainMmr: number(player.max_gain_mmr),
    maxGainLr: number(player.max_gain_lr),
    maxLossMmr: number(player.max_loss_mmr),
    maxLossLr: number(player.max_loss_lr),
    gainloss10Mmr: number(player.gainloss10_mmr),
    gainloss10Lr: number(player.gainloss10_lr),
    wins10: number(player.wins10),
    loss10: number(player.loss10),
    win10Percentage: number(player.win10_percentage),
    winStreak: number(player.win_streak),
    averageScore: number(player.average_score),
    average10Score: number(player.average10_score),
    stdScore: number(player.std_score),
    std10Score: number(player.std10_score),
    topScore: number(player.top_score),
    nosqWins: number(player.nosq_wins),
    nosqLosses: number(player.nosq_loss),
    nosqWinPercentage: number(player.nosq_win_percentage),
    nosqMaxGainMmr: number(player.nosq_max_gain_mmr),
    nosqMaxGainLr: number(player.nosq_max_gain_lr),
    nosqMaxLossMmr: number(player.nosq_max_loss_mmr),
    nosqMaxLossLr: number(player.nosq_max_loss_lr),
    nosqGainloss10Mmr: number(player.nosq_gainloss10_mmr),
    nosqGainloss10Lr: number(player.nosq_gainloss10_lr),
    nosqWins10: number(player.nosq_wins10),
    nosqLoss10: number(player.nosq_loss10),
    nosqAverageScore: number(player.nosq_average_score),
    nosqAverage10Score: number(player.nosq_average10_score),
    nosqStdScore: number(player.nosq_std_score),
    nosqStd10Score: number(player.nosq_std10_score),
    nosqTopScore: number(player.nosq_top_score),
    nosqTotalEvents: number(player.nosq_total_events),
    currentDivision: player.current_division || "Unranked",
    currentClass: player.current_class || "Unranked",
    url: player.url,
    emblem: player.current_emblem,
    lastEventDate: player.last_event_date,
    updateDate: player.update_date,
    ladderId,
    trackType: type,
  };
}

for (const ladderId of LADDER_IDS) {
  const type = ladderType(ladderId);
  const rows = parseSmallCsv(new URL(`leaderboard_ladder_id_${ladderId}.csv`, csvRoot));
  loadedLadders.push(ladderId);

  for (const player of rows) {
    const model = playerModelFromRow(player, ladderId, type);

    const existing = players.get(player.player_id);
    if (!existing || (model.updateDate || "") > (existing.updateDate || "")) {
      players.set(player.player_id, model);
    }

    if (ladderId === CURRENT_LADDER_BY_TRACK[type] && model.ranking > 0) {
      buckets[type].players.push(model);
      buckets[type].currentProfiles.set(model.id, model);
    }

    if (
      type === "rt" &&
      (model.peakMmr >= RT_GM_THRESHOLD || model.currentDivision.toLowerCase() === "grandmaster")
    ) {
      noteGrandmaster("rt", {
        id: model.id,
        name: model.name,
        ladderId,
        mmr: Math.max(model.peakMmr, model.currentMmr),
        lr: Math.max(model.peakLr, model.currentLr),
        method: model.peakMmr >= RT_GM_THRESHOLD ? "peak MMR >= 14,000" : "Grandmaster division export",
      });
    }
    if (model.currentDivision.toLowerCase() === "grandmaster") {
      noteGrandmaster(type, {
        id: model.id,
        name: model.name,
        ladderId,
        mmr: Math.max(model.peakMmr, model.currentMmr),
        lr: Math.max(model.peakLr, model.currentLr),
        method: "Grandmaster division export",
      });
    }
  }
}

function addPlayerEvent(bucket, event) {
  if (!bucket.byPlayerEvents.has(event.playerId)) {
    bucket.byPlayerEvents.set(event.playerId, []);
  }
  bucket.byPlayerEvents.get(event.playerId).push({
    dateMs: event.date.getTime(),
    score: event.score,
    changeMmr: event.changeMmr,
    playerName: event.playerName,
    ladderId: event.ladderId,
    eventId: event.eventId,
  });
}

function addCurrentPlayerEvent(bucket, event) {
  if (event.ladderId !== bucket.currentLadderId) {
    return;
  }
  if (!bucket.currentPlayerEvents.has(event.playerId)) {
    bucket.currentPlayerEvents.set(event.playerId, []);
  }
  bucket.currentPlayerEvents.get(event.playerId).push({
    eventId: event.eventId,
    date: event.dateRaw.slice(0, 10),
    tier: event.tier,
    format: event.type,
    rank: event.ranking,
    score: event.score,
    races: event.races,
    result: event.ranking === 1 ? "Win" : "Loss",
    changeMmr: event.changeMmr,
    updatedMmr: event.updatedMmr,
    changeLr: event.changeLr,
    updatedLr: event.updatedLr,
    url: `https://www.mkwlounge.gg/ladder/table.php?event_id=${event.eventId}&ladder_id=${event.ladderId}`,
  });
}

function addRankOneSegment(bucket, segment, endDate) {
  const days = Math.max(1, Math.round(daysBetween(segment.start, endDate)));
  const existing = bucket.rankOneByPlayer.get(segment.id) || {
    id: segment.id,
    name: segment.name,
    days: 0,
    stints: 0,
    peakMmr: 0,
  };
  existing.days += days;
  existing.stints += 1;
  existing.peakMmr = Math.max(existing.peakMmr, segment.peakMmr);
  bucket.rankOneByPlayer.set(segment.id, existing);

  bucket.rankOneSegments.push({
    id: segment.id,
    name: segment.name,
    ladderId: segment.ladderId,
    startDate: segment.start,
    endDate,
    days,
    peakMmr: Math.round(segment.peakMmr),
  });
}

async function processEventFile(ladderId) {
  const type = ladderType(ladderId);
  const bucket = buckets[type];
  const path = new URL(`events_ladder_id_${ladderId}.csv`, csvRoot);
  const rl = createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  });

  let headers = null;
  let currentGroup = null;
  let currentLeader = null;
  const seenMmr = new Map();

  function closeGroup() {
    if (!currentGroup) {
      return;
    }

    bucket.eventCount += 1;
    const month = currentGroup.date.toISOString().slice(0, 7);
    const year = currentGroup.date.toISOString().slice(0, 4);
    bucket.volumeByMonth.set(month, (bucket.volumeByMonth.get(month) || 0) + 1);
    bucket.volumeByYear.set(year, (bucket.volumeByYear.get(year) || 0) + 1);
    const range = bucket.seasonRanges.get(ladderId) || {
      ladderId,
      label: `${bucket.label} S${ladderId}`,
      startMs: currentGroup.date.getTime(),
      endMs: currentGroup.date.getTime(),
      eventCount: 0,
    };
    range.startMs = Math.min(range.startMs, currentGroup.date.getTime());
    range.endMs = Math.max(range.endMs, currentGroup.date.getTime());
    range.eventCount += 1;
    bucket.seasonRanges.set(ladderId, range);

    for (const event of currentGroup.rows) {
      if (!seenMmr.has(event.playerId)) {
        seenMmr.set(event.playerId, event.currentMmr);
      }
    }
    for (const event of currentGroup.rows) {
      seenMmr.set(event.playerId, event.updatedMmr);
    }

    let top = null;
    for (const [id, mmr] of seenMmr.entries()) {
      if (!top || mmr > top.mmr) {
        const lastEvent = bucket.byPlayerEvents.get(id)?.at(-1);
        top = {
          id,
          name: players.get(id)?.name || lastEvent?.playerName || `Player ${id}`,
          mmr,
        };
      }
    }

    if (top && (!currentLeader || top.id !== currentLeader.id)) {
      if (currentLeader) {
        addRankOneSegment(bucket, currentLeader, currentGroup.date);
      }
      currentLeader = {
        id: top.id,
        name: top.name,
        start: currentGroup.date,
        peakMmr: top.mmr,
        ladderId,
      };
    } else if (top && currentLeader) {
      currentLeader.peakMmr = Math.max(currentLeader.peakMmr, top.mmr);
    }
  }

  for await (const line of rl) {
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }
    if (!line) {
      continue;
    }

    const fields = parseCsvLine(line);
    if (fields.length !== headers.length) {
      continue;
    }

    const row = Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ""]));
    const date = dateFromSql(row.event_date);
    if (!Number.isFinite(date.getTime())) {
      continue;
    }

    const event = {
      eventId: row.event_id,
      detailId: row.event_detail_id,
      ladderId,
      trackType: type,
      type: row.event_type || "Event",
      tier: row.tier || "Unknown",
      date,
      dateRaw: row.event_date,
      playerId: row.player_id,
      playerName: row.player_name || players.get(row.player_id)?.name || `Player ${row.player_id}`,
      score: number(row.score),
      races: number(row.races),
      currentMmr: number(row.current_mmr),
      changeMmr: number(row.change_mmr),
      updatedMmr: number(row.updated_mmr),
      currentLr: number(row.current_lr),
      changeLr: number(row.change_lr),
      updatedLr: number(row.updated_lr),
      ranking: number(row.ranking),
      team: number(row.team),
      subbedOut: number(row.subbed_out),
      subbedIn: number(row.subbed_in),
      currentDivision: row.current_division || "",
      updatedDivision: row.updated_division || "",
    };

    bucket.earliestEvent = !bucket.earliestEvent || event.date < bucket.earliestEvent ? event.date : bucket.earliestEvent;
    bucket.latestEvent = !bucket.latestEvent || event.date > bucket.latestEvent ? event.date : bucket.latestEvent;
    bucket.totalPlayerEntries += 1;

    bucket.eventCounts.set(event.playerId, (bucket.eventCounts.get(event.playerId) || 0) + 1);
    addPlayerEvent(bucket, event);
    addCurrentPlayerEvent(bucket, event);

    if (
      type === "rt" &&
      (event.updatedMmr >= RT_GM_THRESHOLD ||
        event.currentMmr >= RT_GM_THRESHOLD ||
        event.currentDivision.toLowerCase() === "grandmaster" ||
        event.updatedDivision.toLowerCase() === "grandmaster")
    ) {
      noteGrandmaster("rt", {
        id: event.playerId,
        name: players.get(event.playerId)?.name || event.playerName,
        ladderId,
        mmr: Math.max(event.currentMmr, event.updatedMmr),
        lr: Math.max(event.currentLr, event.updatedLr),
        date: event.date,
        method: event.updatedMmr >= RT_GM_THRESHOLD || event.currentMmr >= RT_GM_THRESHOLD
          ? "event MMR >= 14,000"
          : "event division Grandmaster",
      });
    }
    if (event.currentDivision.toLowerCase() === "grandmaster" || event.updatedDivision.toLowerCase() === "grandmaster") {
      noteGrandmaster(type, {
        id: event.playerId,
        name: players.get(event.playerId)?.name || event.playerName,
        ladderId,
        mmr: Math.max(event.currentMmr, event.updatedMmr),
        lr: Math.max(event.currentLr, event.updatedLr),
        date: event.date,
        method: "event division Grandmaster",
      });
    }

    if (event.races >= 12 && event.score > 0 && event.subbedOut === 0 && event.subbedIn === 0) {
      const scoreItem = {
        id: event.playerId,
        name: players.get(event.playerId)?.name || event.playerName,
        value: event.score,
        races: event.races,
        type: event.type,
        tier: event.tier,
        eventId: event.eventId,
        ladderId,
        trackType: type,
        date: event.dateRaw.slice(0, 10),
        mmrDelta: event.changeMmr,
        eventUrl: `https://www.mkwlounge.gg/ladder/table.php?event_id=${event.eventId}&ladder_id=${ladderId}`,
      };
      bucket.scoreSum += event.score;
      bucket.scoreCount += 1;
      pushLimited(bucket.topScores, scoreItem, (a, b) => b.value - a.value || b.mmrDelta - a.mmrDelta, 16);
      pushLimited(bucket.lowScores, scoreItem, (a, b) => a.value - b.value || b.mmrDelta - a.mmrDelta, 16);
      pushLimited(bucket.biggestGains, scoreItem, (a, b) => b.mmrDelta - a.mmrDelta || b.value - a.value, 12);
      pushLimited(bucket.biggestLosses, scoreItem, (a, b) => a.mmrDelta - b.mmrDelta || a.value - b.value, 12);
      if (event.races === 12 || event.races === 32) {
        pushLimited(
          bucket.topScoresByRace[event.races],
          scoreItem,
          (a, b) => b.value - a.value || b.mmrDelta - a.mmrDelta,
          16,
        );
        pushLimited(
          bucket.lowScoresByRace[event.races],
          scoreItem,
          (a, b) => a.value - b.value || b.mmrDelta - a.mmrDelta,
          16,
        );
      }
    }

    if (!currentGroup || currentGroup.id !== event.eventId) {
      closeGroup();
      currentGroup = {
        id: event.eventId,
        date: event.date,
        rows: [],
      };
    }
    currentGroup.rows.push(event);
  }

  closeGroup();
  if (currentLeader && currentGroup) {
    addRankOneSegment(bucket, currentLeader, currentGroup.date);
  }
}

for (const ladderId of LADDER_IDS) {
  console.log(`processing ${trackLabel(ladderType(ladderId))} ladder ${ladderId}`);
  await processEventFile(ladderId);
}

function finalizeBucket(bucket) {
  const mostEvents = [...bucket.eventCounts.entries()]
    .map(([id, value]) => ({
      id,
      name: players.get(id)?.name || bucket.byPlayerEvents.get(id)?.at(-1)?.playerName || `Player ${id}`,
      value,
      currentMmr: players.get(id)?.currentMmr ?? 0,
    }))
    .sort((a, b) => b.value - a.value || b.currentMmr - a.currentMmr)
    .slice(0, 80);

  const breaks = [];
  for (const [id, rows] of bucket.byPlayerEvents.entries()) {
    rows.sort((a, b) => a.dateMs - b.dateMs);
    let bestGap = 0;
    let from = null;
    let to = null;

    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const next = rows[index];
      const gap = Math.max(0, (next.dateMs - previous.dateMs) / 86400000);
      if (gap > bestGap) {
        bestGap = gap;
        from = previous;
        to = next;
      }
    }

    if (bestGap >= 90 && to) {
      breaks.push({
        id,
        name: players.get(id)?.name || to.playerName,
        days: Math.round(bestGap),
        from: fmtDate(new Date(from.dateMs)),
        to: fmtDate(new Date(to.dateMs)),
        returnScore: to.score,
        returnDelta: to.changeMmr,
        returnEventUrl: `https://www.mkwlounge.gg/ladder/table.php?event_id=${to.eventId}&ladder_id=${to.ladderId}`,
        events: rows.length,
        ladderId: to.ladderId,
        trackType: bucket.type,
      });
    }
  }
  breaks.sort((a, b) => b.days - a.days || b.events - a.events);

  const rankOneLeaderboard = [...bucket.rankOneByPlayer.values()]
    .sort((a, b) => b.days - a.days || b.peakMmr - a.peakMmr)
    .slice(0, 14);

  bucket.rankOneSegments.sort((a, b) => a.startDate - b.startDate);
  const totalDays = Math.max(1, daysBetween(bucket.earliestEvent, bucket.latestEvent));
  const timeline = bucket.rankOneSegments
    .filter((segment) => segment.days >= 1)
    .map((segment) => ({
      id: segment.id,
      name: segment.name,
      ladderId: segment.ladderId,
      trackType: bucket.type,
      start: segment.startDate.toISOString().slice(0, 10),
      end: segment.endDate.toISOString().slice(0, 10),
      days: segment.days,
      peakMmr: segment.peakMmr,
      offsetPct: (daysBetween(bucket.earliestEvent, segment.startDate) / totalDays) * 100,
      widthPct: (Math.max(1, daysBetween(segment.startDate, segment.endDate)) / totalDays) * 100,
    }));

  const volumeByMonth = [...bucket.volumeByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      label: compactDate(new Date(`${month}-01T00:00:00Z`)),
      value,
    }));
  const maxMonth = Math.max(...volumeByMonth.map((item) => item.value), 1);
  const volumeByYear = [...bucket.volumeByYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, value]) => ({ year, label: year, value }));
  const maxYear = Math.max(...volumeByYear.map((item) => item.value), 1);

  const divisionCounts = new Map();
  for (const player of bucket.players) {
    divisionCounts.set(player.currentDivision, (divisionCounts.get(player.currentDivision) || 0) + 1);
  }

  const sortedCurrentPlayers = [...bucket.players].sort((a, b) => a.ranking - b.ranking);
  const currentLeaderboard = sortedCurrentPlayers.map((player) => ({
    id: player.id,
    name: player.name,
    ranking: player.ranking,
    currentMmr: player.currentMmr,
    currentLr: player.currentLr,
    peakMmr: player.peakMmr,
    peakLr: player.peakLr,
    totalEvents: player.totalEvents,
    wins: player.wins,
    losses: player.losses,
    winPercentage: Number((player.winPercentage * 100).toFixed(1)),
    averageScore: Number(player.averageScore.toFixed(1)),
    topScore: player.topScore,
    currentDivision: player.currentDivision,
    currentClass: player.currentClass,
    url: player.url,
  }));

  const playerProfiles = Object.fromEntries(
    sortedCurrentPlayers.map((player) => {
      const events = (bucket.currentPlayerEvents.get(player.id) || [])
        .sort((a, b) => b.date.localeCompare(a.date) || number(b.eventId) - number(a.eventId))
        .slice(0, 32);

      return [
        player.id,
        {
          ...player,
          winPercentage: Number((player.winPercentage * 100).toFixed(1)),
          win10Percentage: Number((player.win10Percentage * 100).toFixed(1)),
          nosqWinPercentage: Number((player.nosqWinPercentage * 100).toFixed(1)),
          events,
        },
      ];
    }),
  );

  const currentTop = sortedCurrentPlayers.slice(0, 12).map((player) => ({
      id: player.id,
      name: player.name,
      ranking: player.ranking,
      currentMmr: player.currentMmr,
      currentLr: player.currentLr,
      peakMmr: player.peakMmr,
      peakLr: player.peakLr,
      totalEvents: player.totalEvents,
      averageScore: Number(player.averageScore.toFixed(1)),
      division: player.currentDivision,
      className: player.currentClass,
      url: player.url,
    }));

  const minEventsForRates = bucket.type === "ct" ? 25 : 50;
  const currentSpotlights = {
    bestAverageScore: [...sortedCurrentPlayers]
      .filter((player) => player.totalEvents >= minEventsForRates)
      .sort((a, b) => b.averageScore - a.averageScore || b.totalEvents - a.totalEvents)
      .slice(0, 10)
      .map((player) => ({
        id: player.id,
        name: player.name,
        value: Number(player.averageScore.toFixed(1)),
        events: player.totalEvents,
      })),
    bestWinRate: [...sortedCurrentPlayers]
      .filter((player) => player.totalEvents >= minEventsForRates)
      .sort((a, b) => b.winPercentage - a.winPercentage || b.totalEvents - a.totalEvents)
      .slice(0, 10)
      .map((player) => ({
        id: player.id,
        name: player.name,
        value: Number((player.winPercentage * 100).toFixed(1)),
        events: player.totalEvents,
      })),
    hottestLast10: [...sortedCurrentPlayers]
      .filter((player) => player.wins10 + player.loss10 >= 5)
      .sort((a, b) => b.gainloss10Mmr - a.gainloss10Mmr || b.average10Score - a.average10Score)
      .slice(0, 10)
      .map((player) => ({
        id: player.id,
        name: player.name,
        value: player.gainloss10Mmr,
        average10Score: Number(player.average10Score.toFixed(1)),
      })),
  };

  const latestUpdate = bucket.players
    .map((player) => player.updateDate)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    meta: {
      label: bucket.label,
      currentLadderId: bucket.currentLadderId,
      generatedAt: latestUpdate,
      eventDateRange: {
        start: fmtDate(bucket.earliestEvent),
        end: fmtDate(bucket.latestEvent),
      },
    },
    seasonRanges: [...bucket.seasonRanges.values()]
      .sort((a, b) => a.ladderId - b.ladderId)
      .map((range) => ({
        ladderId: range.ladderId,
        label: range.label,
        start: new Date(range.startMs).toISOString().slice(0, 10),
        end: new Date(range.endMs).toISOString().slice(0, 10),
        displayStart: fmtDate(new Date(range.startMs)),
        displayEnd: fmtDate(new Date(range.endMs)),
        eventCount: range.eventCount,
      })),
    summary: {
      currentSeasonPlayers: bucket.players.length,
      eventCount: bucket.eventCount,
      totalPlayerEntries: bucket.totalPlayerEntries,
      avgScore: Number((bucket.scoreSum / Math.max(1, bucket.scoreCount)).toFixed(1)),
      currentRankOne: currentTop[0],
      longestBreak: breaks[0],
      highestScore: bucket.topScores[0],
      lowestScore: bucket.lowScores[0],
      rankOneKing: rankOneLeaderboard[0],
    },
    timeline,
    rankOneLeaderboard,
    currentTop,
    currentLeaderboard,
    playerProfiles,
    currentSpotlights,
    allEventCounts: mostEvents,
    topScores: bucket.topScores,
    lowScores: bucket.lowScores,
    topScoresByRace: bucket.topScoresByRace,
    lowScoresByRace: bucket.lowScoresByRace,
    biggestGains: bucket.biggestGains,
    biggestLosses: bucket.biggestLosses,
    breaks: breaks.slice(0, 16),
    volumeByMonth: volumeByMonth.map((item) => ({
      ...item,
      pct: (item.value / maxMonth) * 100,
    })),
    volumeByYear: volumeByYear.map((item) => ({
      ...item,
      pct: (item.value / maxYear) * 100,
    })),
    divisionSpread: [...divisionCounts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  };
}

const byTrack = {
  rt: finalizeBucket(buckets.rt),
  ct: finalizeBucket(buckets.ct),
};

function finalizeGrandmasters(trackType) {
  return [...grandmasterMaps[trackType].values()]
    .sort((a, b) => b.peakMmr - a.peakMmr || a.firstHitMs - b.firstHitMs)
    .map(({ firstHitMs, ...row }) => row);
}

const grandmastersByTrack = {
  rt: finalizeGrandmasters("rt"),
  ct: finalizeGrandmasters("ct"),
};
const latestExportUpdate = [byTrack.rt.meta.generatedAt, byTrack.ct.meta.generatedAt]
  .filter(Boolean)
  .sort()
  .at(-1);

writeFileSync(
  generatedLaddersPath,
  `// Regenerated by work/build-dashboard-data.mjs during scheduled refreshes.\nexport const currentLadderIds = {\n  rt: ${CURRENT_LADDER_BY_TRACK.rt},\n  ct: ${CURRENT_LADDER_BY_TRACK.ct},\n} as const;\n`,
);

mkdirSync(new URL("public", root), { recursive: true });
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      meta: {
        sourceTimestamp: latestExportUpdate
          ? `${latestExportUpdate} MKW Lounge export`
          : `${new Date().toISOString()} generated snapshot`,
        builtAt: new Date().toISOString(),
        loadedLadders,
        note: `RT uses odd ladder IDs and CT uses even ladder IDs, with exports loaded through ladder ${MAX_LADDER_ID}. Event links point to MKW Lounge table.php result pages.`,
      },
      playerCount: players.size,
      byTrack,
      grandmastersByTrack,
      rtGrandmasters: grandmastersByTrack.rt,
    },
    null,
    2,
  ),
);

console.log(`Wrote ${outputPath.pathname}`);

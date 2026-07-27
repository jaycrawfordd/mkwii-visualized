import { createWriteStream, existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

const out = new URL("csv/", new URL("work/", new URL("../", import.meta.url)));
await mkdir(out, { recursive: true });
const statePath = new URL("current-ladders.json", import.meta.url);
const discovered = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const maxLadderId = Number(process.env.MKW_MAX_LADDER_ID || discovered.maxLadderId || 20);
const currentLadderIds = new Set(
  (process.env.MKW_CURRENT_LADDER_IDS || `${discovered.rt || 19},${discovered.ct || 20}`)
    .split(",")
    .map(Number)
    .filter(Number.isFinite),
);
const forceAll = process.argv.includes("--force-all");
const minCsvSize = 1024;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isUsableCsv(path) {
  return existsSync(path) && statSync(path).size > minCsvSize;
}

async function download(url, destination, refresh) {
  if (!refresh && isUsableCsv(destination)) {
    return "cached";
  }

  const temporary = new URL(`${destination.pathname}.part`, destination);
  await rm(temporary, { force: true });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "text/csv,*/*;q=0.8",
          "user-agent": "MKW Lounge Ladder Lab scheduled data refresh",
        },
        signal: AbortSignal.timeout(15 * 60 * 1000),
      });
      if (!response.ok || !response.body) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      await pipeline(response.body, createWriteStream(temporary));
      if (!isUsableCsv(temporary)) {
        throw new Error("download was empty or unexpectedly small");
      }
      await rename(temporary, destination);
      return "downloaded";
    } catch (error) {
      await rm(temporary, { force: true });
      if (attempt === 3) {
        throw new Error(`Unable to download ${url}: ${error.message}`);
      }
      await delay(attempt * 3000);
    }
  }
}

for (let ladderId = 1; ladderId <= maxLadderId; ladderId += 1) {
  const leaderUrl = `https://mkwlounge.gg/csv/leaderboard_ladder_id_${ladderId}.csv`;
  const eventsUrl = `https://mkwlounge.gg/csv/events_ladder_id_${ladderId}.csv`;
  const leaderPath = new URL(`leaderboard_ladder_id_${ladderId}.csv`, out);
  const eventsPath = new URL(`events_ladder_id_${ladderId}.csv`, out);
  const refresh = forceAll || currentLadderIds.has(ladderId);

  const leaderStatus = await download(leaderUrl, leaderPath, refresh);
  const eventsStatus = await download(eventsUrl, eventsPath, refresh);
  console.log(`ladder ${ladderId}: leaderboard ${leaderStatus}, events ${eventsStatus}`);
}

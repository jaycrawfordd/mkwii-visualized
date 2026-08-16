import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the MKW Lounge dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>MKW Lounge All-Time Ladder Lab<\/title>/i);
  assert.match(html, /MKW Lounge All-Time Ladder Lab/);
  assert.match(html, /Loading the all-time ladder export/);
  assert.match(html, /Fetching stats from the generated dashboard dataset/);
  assert.doesNotMatch(html, /92,986/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships the generated all-time ladder summary", async () => {
  const data = JSON.parse(await readFile(new URL("../public/dashboard-data.json", import.meta.url), "utf8"));

  assert.ok(data.meta.loadedLadders.length >= 20);
  assert.deepEqual(
    data.meta.loadedLadders,
    Array.from({ length: data.meta.loadedLadders.length }, (_, index) => index + 1),
  );
  assert.ok(data.byTrack.rt.summary.eventCount > 90000);
  assert.ok(data.byTrack.ct.summary.eventCount > 15000);
  assert.equal(data.byTrack.rt.summary.currentRankOne.ranking, 1);
  assert.equal(data.byTrack.ct.summary.currentRankOne.ranking, 1);
  assert.ok(data.byTrack.rt.summary.currentRankOne.name.length > 0);
  assert.ok(data.byTrack.ct.summary.currentRankOne.name.length > 0);
  assert.ok(data.byTrack.rt.timeline.length > 400);
  assert.ok(data.byTrack.ct.timeline.length > 250);
  assert.ok(data.byTrack.rt.topScores[0].eventUrl.includes("table.php"));
  assert.equal(data.byTrack.rt.topScoresByRace["12"][0].races, 12);
  assert.equal(data.byTrack.rt.topScoresByRace["32"][0].races, 32);
  assert.equal(data.byTrack.rt.lowScoresByRace["12"][0].races, 12);
  assert.equal(data.byTrack.rt.lowScoresByRace["32"][0].races, 32);
  assert.ok(data.byTrack.rt.breaks[0].returnEventUrl.includes("table.php"));
  assert.ok(data.byTrack.rt.allEventCounts.length >= 60);
  assert.ok(data.byTrack.rt.volumeByYear.length >= 5);
  assert.ok(data.byTrack.rt.seasonRanges.length >= 9);
  assert.ok(data.byTrack.rt.currentLeaderboard.length > 1000);
  assert.ok(Object.keys(data.byTrack.rt.playerProfiles).length > 1000);
  assert.ok(data.byTrack.rt.playerProfiles[data.byTrack.rt.currentLeaderboard[0].id].events[0].url.includes("table.php"));
  assert.ok(data.byTrack.rt.currentSpotlights.bestAverageScore.length > 0);
  assert.ok(data.grandmastersByTrack.rt.length > 25);
  assert.ok(data.grandmastersByTrack.ct.length > 10);
  assert.ok(data.rtGrandmasters.length > 25);
});

test("ships the complete Almia Upper tournament analysis", async () => {
  const data = JSON.parse(await readFile(new URL("../public/almia-upper-data.json", import.meta.url), "utf8"));

  assert.equal(data.meta.ratingCutoff, "2026-08-15T16:01:00Z");
  assert.equal(data.summary.registeredPlayers, 85);
  assert.equal(data.summary.competitors, 84);
  assert.equal(data.summary.rooms, 14);
  assert.equal(data.summary.rounds, 4);
  assert.equal(data.summary.winner, "Cormac");
  assert.equal(data.summary.winnerScore, 107);
  assert.equal(data.summary.matchedPlayers, 85);
  assert.deepEqual(data.meta.unmatched, []);
  assert.equal(data.roomDifficulty.length, 14);
  assert.equal(data.rankDistribution.length, 11);
  assert.equal(data.finalPlayers.length, 12);
  assert.equal(data.players.length, 85);
  assert.deepEqual(data.topRankCounts.map(({ threshold }) => threshold), [10, 25, 50, 100]);

  const kali = data.players.find((player) => player.name === "kali");
  assert.equal(kali.competed, false);
  assert.equal(kali.result, "DNS");
  assert.equal(data.players.find((player) => player.name === "Edwin").sourceName, "EdwinLP");
  assert.equal(data.players.find((player) => player.name === "pttmxrx").sourceName, "veil");
  assert.ok(data.roomDifficulty.some((room) => room.id === "r4-room-1"));
});

test("ships navigable RT and CT seasonal history", async () => {
  const data = JSON.parse(await readFile(new URL("../public/seasonal-data.json", import.meta.url), "utf8"));

  assert.equal(data.seasons.length, 20);
  assert.equal(data.seasons.filter((season) => season.meta.track === "rt").length, 10);
  assert.equal(data.seasons.filter((season) => season.meta.track === "ct").length, 10);

  const currentRt = data.seasons.find((season) => season.meta.ladderId === 19);
  assert.equal(currentRt.meta.current, true);
  assert.equal(currentRt.meta.start, "2026-03-28");
  assert.ok(currentRt.meta.eventCount > 6000);
  assert.ok(currentRt.leaderboard.length > 1000);
  assert.ok(currentRt.greatestGains.length > 0);
  assert.ok(currentRt.greatestFalls.length > 0);
  assert.ok(currentRt.improvements.length > 0);
  assert.ok(currentRt.divisionHits.some((row) => row.division === "Grandmaster"));
  assert.ok(currentRt.largestMmrGains[0].url.includes("table.php"));
  assert.ok(currentRt.largestLrLosses[0].url.includes("table.php"));
  assert.ok(currentRt.teammatePairs.length > 0);
  assert.equal(currentRt.rankDistribution.length, 12);
  assert.ok(currentRt.bans.some((ban) => ban.player === "zilla"));
});

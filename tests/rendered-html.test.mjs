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

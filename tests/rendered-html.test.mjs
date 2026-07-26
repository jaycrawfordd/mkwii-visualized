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
  assert.match(html, /All-Time Rank 1 Control/);
  assert.match(html, /RT(?:<!-- -->|\s)*· Ladder(?:<!-- -->|\s)*19/);
  assert.match(html, /92,986/);
  assert.match(html, /Kasperinos/);
  assert.match(html, /Most All-Time Events/);
  assert.match(html, /Players Who Hit RT Grandmaster All Time/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships the generated all-time ladder summary", async () => {
  const data = JSON.parse(await readFile(new URL("../public/dashboard-data.json", import.meta.url), "utf8"));

  assert.equal(data.meta.loadedLadders.length, 20);
  assert.equal(data.byTrack.rt.summary.eventCount, 92986);
  assert.equal(data.byTrack.rt.summary.currentRankOne.name, "Kasperinos");
  assert.equal(data.byTrack.ct.summary.currentRankOne.name, "TCR");
  assert.ok(data.byTrack.rt.timeline.length > 400);
  assert.ok(data.byTrack.ct.timeline.length > 250);
  assert.ok(data.byTrack.rt.topScores[0].eventUrl.includes("table.php"));
  assert.ok(data.rtGrandmasters.length > 25);
});

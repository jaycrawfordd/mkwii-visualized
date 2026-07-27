import { appendFile, writeFile } from "node:fs/promises";

const statePath = new URL("current-ladders.json", import.meta.url);

const knownMax = Number(process.env.MKW_KNOWN_MAX_LADDER_ID || 20);
let currentRt = knownMax % 2 === 1 ? knownMax : knownMax - 1;
let currentCt = knownMax % 2 === 0 ? knownMax : knownMax - 1;

async function ladderExists(ladderId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`https://mkwlounge.gg/ladder/data.php?ladder_id=${ladderId}`, {
      headers: {
        accept: "text/html,*/*;q=0.8",
        "user-agent": "MKW Lounge Ladder Lab season discovery",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }

    const html = await response.text();
    return (
      html.includes(`leaderboard_ladder_id_${ladderId}.csv`) &&
      html.includes(`events_ladder_id_${ladderId}.csv`)
    );
  } finally {
    clearTimeout(timeout);
  }
}

while (Math.max(currentRt, currentCt) < 100) {
  const nextRt = currentRt + 2;
  const nextCt = currentCt + 2;
  const [hasNextRt, hasNextCt] = await Promise.all([
    ladderExists(nextRt),
    ladderExists(nextCt),
  ]);

  if (!hasNextRt && !hasNextCt) {
    break;
  }
  if (hasNextRt) {
    currentRt = nextRt;
  }
  if (hasNextCt) {
    currentCt = nextCt;
  }
}

const values = {
  MKW_MAX_LADDER_ID: Math.max(currentRt, currentCt),
  MKW_CURRENT_LADDER_IDS: `${currentRt},${currentCt}`,
  MKW_CURRENT_RT_LADDER_ID: currentRt,
  MKW_CURRENT_CT_LADDER_ID: currentCt,
};

console.log(`Current ladders: RT ${currentRt}, CT ${currentCt}`);
await writeFile(
  statePath,
  JSON.stringify({ maxLadderId: values.MKW_MAX_LADDER_ID, rt: currentRt, ct: currentCt }, null, 2) + "\n",
);

if (process.env.GITHUB_ENV) {
  await appendFile(
    process.env.GITHUB_ENV,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
  );
}

if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `max_ladder_id=${values.MKW_MAX_LADDER_ID}\nrt_ladder_id=${currentRt}\nct_ladder_id=${currentCt}\n`,
  );
}

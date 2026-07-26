type TrackType = "rt" | "ct";

const tracks: Record<TrackType, { label: string; ladderId: number; pageUrl: string }> = {
  rt: {
    label: "Retro Tracks",
    ladderId: 19,
    pageUrl: "https://mkwlounge.gg/ladder/data.php?ladder_id=19",
  },
  ct: {
    label: "Custom Tracks",
    ladderId: 20,
    pageUrl: "https://mkwlounge.gg/ladder/data.php?ladder_id=20",
  },
};

function textMatch(html: string, pattern: RegExp) {
  return html.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function absolutize(href: string | null) {
  if (!href) {
    return null;
  }
  return new URL(href, "https://mkwlounge.gg/ladder/").toString();
}

async function getTrackStatus(track: TrackType) {
  const config = tracks[track];
  const response = await fetch(config.pageUrl, {
    cache: "no-store",
    headers: {
      "user-agent": "MKW Lounge Ladder Lab live status",
    },
  });

  if (!response.ok) {
    throw new Error(`${config.label} status failed with ${response.status}`);
  }

  const html = await response.text();
  const leaderboard = html.match(/<a\s+href="([^"]+)">Leaderboard \(([^<]+)\)<\/a>/i);
  const events = html.match(/<a\s+href="([^"]+)">Events \(([^<]+)\)<\/a>/i);

  return {
    label: config.label,
    ladderId: config.ladderId,
    pageUrl: config.pageUrl,
    currentTimestamp: textMatch(html, /Current Timestamp:\s*([^<]+)/i),
    leaderboard: {
      text: leaderboard?.[2]?.trim() ?? null,
      href: absolutize(leaderboard?.[1] ?? null),
    },
    events: {
      text: events?.[2]?.trim() ?? null,
      href: absolutize(events?.[1] ?? null),
    },
  };
}

export async function GET() {
  try {
    const [rt, ct] = await Promise.all([getTrackStatus("rt"), getTrackStatus("ct")]);

    return Response.json(
      {
        checkedAt: new Date().toISOString(),
        tracks: { rt, ct },
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch MKW Lounge status",
      },
      { status: 502 },
    );
  }
}

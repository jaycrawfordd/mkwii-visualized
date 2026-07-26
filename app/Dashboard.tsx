"use client";

import { useMemo, useState } from "react";

type TrackType = "rt" | "ct";

type ScoreRow = {
  id: string;
  name: string;
  value: number;
  races?: number;
  type?: string;
  tier?: string;
  eventId?: string;
  ladderId?: number;
  trackType?: TrackType;
  date?: string;
  mmrDelta?: number;
  eventUrl?: string;
};

type RankOneRow = {
  id: string;
  name: string;
  days: number;
  stints: number;
  peakMmr: number;
};

type TimelineRow = {
  id: string;
  name: string;
  ladderId: number;
  trackType: TrackType;
  start: string;
  end: string;
  days: number;
  peakMmr: number;
  offsetPct: number;
  widthPct: number;
};

type BreakRow = {
  id: string;
  name: string;
  days: number;
  from: string;
  to: string;
  returnScore: number;
  returnDelta: number;
  events: number;
  ladderId: number;
  trackType: TrackType;
};

type CurrentTopRow = {
  name: string;
  ranking: number;
  currentMmr: number;
  peakMmr: number;
  totalEvents: number;
  averageScore: number;
  division: string;
  className: string;
  url?: string;
};

type VolumeRow = {
  month: string;
  label: string;
  value: number;
  pct: number;
};

type DivisionRow = {
  name: string;
  value: number;
};

type TrackData = {
  meta: {
    label: string;
    currentLadderId: number;
    generatedAt: string;
    eventDateRange: { start: string; end: string };
  };
  summary: {
    currentSeasonPlayers: number;
    eventCount: number;
    totalPlayerEntries: number;
    avgScore: number;
    currentRankOne: CurrentTopRow;
    longestBreak: BreakRow;
    highestScore: ScoreRow;
    lowestScore: ScoreRow;
    rankOneKing: RankOneRow;
  };
  timeline: TimelineRow[];
  rankOneLeaderboard: RankOneRow[];
  currentTop: CurrentTopRow[];
  allEventCounts: Array<{ id: string; name: string; value: number; currentMmr: number }>;
  topScores: ScoreRow[];
  lowScores: ScoreRow[];
  breaks: BreakRow[];
  volumeByMonth: VolumeRow[];
  divisionSpread: DivisionRow[];
};

type RtGrandmaster = {
  id: string;
  name: string;
  firstHit: string;
  firstSeason: number;
  peakMmr: number;
  peakLr: number;
  evidence: string;
  url: string;
};

type DashboardData = {
  meta: {
    sourceTimestamp: string;
    loadedLadders: number[];
    note: string;
  };
  playerCount: number;
  byTrack: Record<TrackType, TrackData>;
  rtGrandmasters: RtGrandmaster[];
};

const tabs = ["Overview", "Rank 1", "Records", "Returns", "RT GMs"] as const;
type Tab = (typeof tabs)[number];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSigned(value = 0) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function TrackSwitch({ track, onTrackChange }: { track: TrackType; onTrackChange: (track: TrackType) => void }) {
  return (
    <div className="track-switch" aria-label="Track type">
      <button className={track === "rt" ? "active" : ""} onClick={() => onTrackChange("rt")} type="button">
        RT
      </button>
      <button className={track === "ct" ? "active" : ""} onClick={() => onTrackChange("ct")} type="button">
        CT
      </button>
    </div>
  );
}

function BarBoard({
  rows,
  suffix = "",
}: {
  rows: Array<{ id?: string; name: string; value?: number; days?: number; currentMmr?: number }>;
  suffix?: string;
}) {
  const values = rows.map((row) => row.value ?? row.days ?? 0);
  const max = Math.max(...values, 1);

  return (
    <div className="bar-board">
      {rows.map((row, index) => {
        const value = row.value ?? row.days ?? 0;

        return (
          <div className="bar-row" key={`${row.id ?? row.name}-${index}`}>
            <div className="bar-rank">{index + 1}</div>
            <div className="bar-main">
              <div className="bar-label">
                <span>{row.name}</span>
                <b>
                  {formatNumber(value)}
                  {suffix}
                </b>
              </div>
              <div className="bar-track">
                <span style={{ width: `${(value / max) * 100}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreTable({ rows, mode }: { rows: ScoreRow[]; mode: "high" | "low" }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Score</th>
            <th>Races</th>
            <th>Event</th>
            <th>Track</th>
            <th>Season</th>
            <th>Date</th>
            <th>MMR</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${mode}-${row.eventId}-${row.id}-${index}`}>
              <td>{index + 1}</td>
              <td>{row.name}</td>
              <td className={mode === "high" ? "positive" : "danger"}>{row.value}</td>
              <td>{row.races}</td>
              <td>
                {row.type} <small>{row.tier}</small>
              </td>
              <td>{row.trackType?.toUpperCase()}</td>
              <td>S{row.ladderId}</td>
              <td>{row.date ? shortDate(row.date) : "-"}</td>
              <td className={(row.mmrDelta ?? 0) >= 0 ? "positive" : "danger"}>
                {formatSigned(row.mmrDelta)}
              </td>
              <td>
                {row.eventUrl ? (
                  <a className="result-link" href={row.eventUrl} rel="noreferrer" target="_blank">
                    View
                  </a>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Timeline({ rows }: { rows: TimelineRow[] }) {
  const [activeRow, setActiveRow] = useState<TimelineRow | null>(null);
  const colorMap = useMemo(() => {
    const palette = ["#03a9f4", "#b0f442", "#ffcf54", "#ff5c8a", "#8bffda", "#b989ff", "#ff7a45", "#6ed1ff"];
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (!map.has(row.id)) {
        map.set(row.id, palette[map.size % palette.length]);
      }
    });
    return map;
  }, [rows]);

  return (
    <div className="timeline-panel">
      <div className="timeline-axis">
        <span>2021</span>
        <span>2022</span>
        <span>2023</span>
        <span>2024</span>
        <span>2025</span>
        <span>2026</span>
      </div>
      <div className="timeline-track" aria-label="Rank one timeline" onMouseLeave={() => setActiveRow(null)}>
        {rows.map((row, index) => (
          <button
            aria-label={`${row.name}, ${row.days} days from ${row.start} to ${row.end}`}
            className="timeline-segment"
            key={`${row.id}-${row.start}-${row.ladderId}-${index}`}
            onFocus={() => setActiveRow(row)}
            onMouseEnter={() => setActiveRow(row)}
            style={{
              left: `${row.offsetPct}%`,
              width: `${Math.max(0.18, row.widthPct)}%`,
              background: colorMap.get(row.id),
            }}
            title={`${row.name}: ${row.days} days, S${row.ladderId}, ${row.start} to ${row.end}, peak ${row.peakMmr}`}
            type="button"
          />
        ))}
        {activeRow ? (
          <div
            className="timeline-tooltip"
            style={{ left: `${Math.min(78, Math.max(2, activeRow.offsetPct))}%` }}
          >
            <strong>{activeRow.name}</strong>
            <span>
              {shortDate(activeRow.start)} to {shortDate(activeRow.end)}
            </span>
            <b>
              {formatNumber(activeRow.days)} days · {activeRow.trackType.toUpperCase()} S{activeRow.ladderId}
            </b>
            <small>Peak while leading: {formatNumber(activeRow.peakMmr)} MMR</small>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GrandmasterTable({ rows }: { rows: RtGrandmaster[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Peak MMR</th>
            <th>Peak LR</th>
            <th>First Seen</th>
            <th>Season</th>
            <th>Evidence</th>
            <th>Profile</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td>{index + 1}</td>
              <td>{row.name}</td>
              <td className="positive">{formatNumber(row.peakMmr)}</td>
              <td>{formatNumber(row.peakLr)}</td>
              <td>{row.firstHit}</td>
              <td>RT S{row.firstSeason}</td>
              <td>{row.evidence}</td>
              <td>
                <a className="result-link" href={row.url} rel="noreferrer" target="_blank">
                  Open
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard({ data }: { data: DashboardData }) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [track, setTrack] = useState<TrackType>("rt");
  const trackData = data.byTrack[track];
  const trackName = track.toUpperCase();

  return (
    <main>
      <div className="earth-content">
        <div id="earth" />
      </div>

      <nav className="lounge-nav" aria-label="MKW Lounge dashboard navigation">
        <a
          className="nav-brand"
          href={`https://mkwlounge.gg/ladder/index.php?ladder_id=${trackData.meta.currentLadderId}&hide_unranked=0`}
        >
          MKW Lounge
        </a>
        <a href="#current">
          <img alt="" src="/leaderboard.svg" />
          Leaderboard
        </a>
        <a href="#rank-one">
          <img alt="" src="/history.svg" />
          Rank 1
        </a>
        <a href="#records">
          <img alt="" src="/statistics.svg" />
          Records
        </a>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-topline">
            <p className="eyebrow">
              {trackName} · Ladder {trackData.meta.currentLadderId}
            </p>
            <TrackSwitch track={track} onTrackChange={setTrack} />
          </div>
          <h1>MKW Lounge All-Time Ladder Lab</h1>
          <p>
            {trackName} export range {trackData.meta.eventDateRange.start} to {trackData.meta.eventDateRange.end}.
            Switch between Retro Tracks and Custom Tracks to compare rank-one reigns, records, and comeback gaps.
          </p>
        </div>
        <div className="rank-one-card">
          <span>{trackName} All-Time Rank 1 Control</span>
          <strong>{trackData.summary.rankOneKing.name}</strong>
          <div>
            <b>{formatNumber(trackData.summary.rankOneKing.days)}</b> days across{" "}
            {formatNumber(trackData.summary.rankOneKing.stints)} stints
          </div>
        </div>
      </section>

      <section className="stat-grid" aria-label="Dashboard summary">
        <StatTile label={`${trackName} Events`} value={formatNumber(trackData.summary.eventCount)} detail="exported seasons" />
        <StatTile label="Player Rows" value={formatNumber(trackData.summary.totalPlayerEntries)} detail="event entries parsed" />
        <StatTile label="All Players" value={formatNumber(data.playerCount)} detail="unique exported IDs" />
        <StatTile label="Average Score" value={String(trackData.summary.avgScore)} detail="full-event rows" />
        <StatTile
          label={`${trackName} Current #1`}
          value={trackData.summary.currentRankOne.name}
          detail={`${formatNumber(trackData.summary.currentRankOne.currentMmr)} MMR`}
        />
      </section>

      <div className="tab-shell">
        <div className="tabs" role="tablist" aria-label="Dashboard views">
          {tabs.map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "active" : ""}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {(activeTab === "Overview" || activeTab === "Rank 1") && (
        <section className="panel wide" id="rank-one">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{trackName} Rank 1 Over Time</p>
              <h2>Leader reigns reconstructed from event updates</h2>
            </div>
            <span>{formatNumber(trackData.timeline.length)} lead segments</span>
          </div>
          <Timeline rows={trackData.timeline} />
          <div className="split-grid">
            <div>
              <h3>Most Days at #1</h3>
              <BarBoard rows={trackData.rankOneLeaderboard} suffix="d" />
            </div>
            <div>
              <h3>Monthly Event Volume</h3>
              <div className="month-chart">
                {trackData.volumeByMonth.map((row) => (
                  <div className="month-row" key={row.month}>
                    <span>{row.label}</span>
                    <div>
                      <i style={{ width: `${row.pct}%` }} />
                    </div>
                    <b>{formatNumber(row.value)}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {(activeTab === "Overview" || activeTab === "Records") && (
        <section className="records-grid" id="records">
          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">{trackName} Activity</p>
                <h2>Most All-Time Events</h2>
              </div>
            </div>
            <BarBoard rows={trackData.allEventCounts} />
          </div>

          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">{trackName} Score Ceiling</p>
                <h2>Highest Event Scores</h2>
              </div>
            </div>
            <ScoreTable rows={trackData.topScores.slice(0, 10)} mode="high" />
          </div>

          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">{trackName} Score Floor</p>
                <h2>Lowest Full Event Scores</h2>
              </div>
            </div>
            <ScoreTable rows={trackData.lowScores.slice(0, 10)} mode="low" />
          </div>
        </section>
      )}

      {(activeTab === "Overview" || activeTab === "Returns") && (
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{trackName} Comebacks</p>
              <h2>Longest Break Before Returning</h2>
            </div>
            <span>{formatNumber(trackData.summary.longestBreak.days)} day record</span>
          </div>
          <div className="return-list">
            {trackData.breaks.map((row, index) => (
              <article className="return-row" key={`${row.id}-${row.to}-${index}`}>
                <div className="return-rank">{index + 1}</div>
                <div>
                  <strong>{row.name}</strong>
                  <span>
                    {row.from} to {row.to} · {row.trackType.toUpperCase()} S{row.ladderId}
                  </span>
                </div>
                <b>{formatNumber(row.days)} days</b>
                <small>
                  return {row.returnScore} pts · {formatSigned(row.returnDelta)} MMR
                </small>
              </article>
            ))}
          </div>
        </section>
      )}

      {(activeTab === "Overview" || activeTab === "RT GMs") && (
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">RT Grandmaster</p>
              <h2>Players Who Hit RT Grandmaster All Time</h2>
            </div>
            <span>{formatNumber(data.rtGrandmasters.length)} players</span>
          </div>
          <GrandmasterTable rows={data.rtGrandmasters} />
        </section>
      )}

      <section className="bottom-grid" id="current">
        <div className="panel">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">{trackName} Season {trackData.meta.currentLadderId}</p>
              <h2>Current Top 12</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>MMR</th>
                  <th>Peak</th>
                  <th>Events</th>
                  <th>Avg</th>
                  <th>Division</th>
                  <th>Profile</th>
                </tr>
              </thead>
              <tbody>
                {trackData.currentTop.map((row) => (
                  <tr key={row.ranking}>
                    <td>{row.ranking}</td>
                    <td>{row.name}</td>
                    <td className="positive">{formatNumber(row.currentMmr)}</td>
                    <td>{formatNumber(row.peakMmr)}</td>
                    <td>{formatNumber(row.totalEvents)}</td>
                    <td>{row.averageScore}</td>
                    <td>
                      {row.division} <small>{row.className}</small>
                    </td>
                    <td>
                      {row.url ? (
                        <a className="result-link" href={row.url} rel="noreferrer" target="_blank">
                          Open
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">{trackName} Season {trackData.meta.currentLadderId}</p>
              <h2>Division Spread</h2>
            </div>
          </div>
          <BarBoard rows={trackData.divisionSpread} />
        </div>
      </section>

      <footer>
        Data snapshot from MKW Lounge: {data.meta.sourceTimestamp}. Rank-one history uses exported event MMR updates
        and resets within each ladder season; RT Grandmaster includes exported RT Grandmaster division rows and RT MMR
        hits at or above 14,000.
      </footer>
    </main>
  );
}

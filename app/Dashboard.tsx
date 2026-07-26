"use client";

import { useEffect, useMemo, useState } from "react";

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
  returnEventUrl?: string;
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
  topScoresByRace: Record<"12" | "32", ScoreRow[]>;
  lowScoresByRace: Record<"12" | "32", ScoreRow[]>;
  breaks: BreakRow[];
  volumeByMonth: VolumeRow[];
  volumeByYear: VolumeRow[];
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

type LiveSnapshot = {
  checkedAt: string;
  tracks: Record<
    TrackType,
    {
      label: string;
      ladderId: number;
      pageUrl: string;
      currentTimestamp: string | null;
      leaderboard: { text: string | null; href: string | null };
      events: { text: string | null; href: string | null };
    }
  >;
};

const tabs = ["Overview", "Rank 1", "Records", "Returns", "RT GMs"] as const;
type Tab = (typeof tabs)[number];
type RaceFilter = "12" | "32";
type RangeFilter = "all" | string;

const dayMs = 86400000;

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

function dateMs(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

function yearRange(year: string) {
  const start = Date.parse(`${year}-01-01T00:00:00Z`);
  const end = Date.parse(`${Number(year) + 1}-01-01T00:00:00Z`);
  return { start, end };
}

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
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

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="control-group">
      <span>{label}</span>
      <div className="segmented-control">
        {options.map((option) => (
          <button
            className={value === option.value ? "active" : ""}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
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

function buildRankRange(
  rows: TimelineRow[],
  range: RangeFilter,
): { timeline: TimelineRow[]; leaderboard: RankOneRow[]; label: string } {
  if (range === "all") {
    const leaderboard = new Map<string, RankOneRow>();
    rows.forEach((row) => {
      const current = leaderboard.get(row.id) ?? {
        id: row.id,
        name: row.name,
        days: 0,
        stints: 0,
        peakMmr: 0,
      };
      current.days += row.days;
      current.stints += 1;
      current.peakMmr = Math.max(current.peakMmr, row.peakMmr);
      leaderboard.set(row.id, current);
    });
    return {
      timeline: rows,
      leaderboard: [...leaderboard.values()].sort((a, b) => b.days - a.days || b.peakMmr - a.peakMmr),
      label: "All time",
    };
  }

  const { start, end } = yearRange(range);
  const visible = rows
    .map((row) => {
      const rowStart = dateMs(row.start);
      const rowEnd = Math.max(dateMs(row.end), rowStart + dayMs);
      const clippedStart = Math.max(rowStart, start);
      const clippedEnd = Math.min(rowEnd, end);

      if (clippedEnd <= clippedStart) {
        return null;
      }

      const days = Math.max(1, Math.round((clippedEnd - clippedStart) / dayMs));
      return {
        ...row,
        start: new Date(clippedStart).toISOString().slice(0, 10),
        end: new Date(clippedEnd).toISOString().slice(0, 10),
        days,
        offsetPct: ((clippedStart - start) / Math.max(1, end - start)) * 100,
        widthPct: ((clippedEnd - clippedStart) / Math.max(1, end - start)) * 100,
      };
    })
    .filter(Boolean) as TimelineRow[];

  const leaderboard = new Map<string, RankOneRow>();
  visible.forEach((row) => {
    const current = leaderboard.get(row.id) ?? {
      id: row.id,
      name: row.name,
      days: 0,
      stints: 0,
      peakMmr: 0,
    };
    current.days += row.days;
    current.stints += 1;
    current.peakMmr = Math.max(current.peakMmr, row.peakMmr);
    leaderboard.set(row.id, current);
  });

  return {
    timeline: visible,
    leaderboard: [...leaderboard.values()].sort((a, b) => b.days - a.days || b.peakMmr - a.peakMmr),
    label: range,
  };
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

function LiveStatus({ live, onRefresh }: { live: LiveSnapshot | null; onRefresh: () => void }) {
  return (
    <section className="live-strip" aria-label="Live MKW Lounge export status">
      <div>
        <p className="eyebrow">Live Export Status</p>
        <h2>MKW Lounge hourly source check</h2>
      </div>
      <div className="live-items">
        {(["rt", "ct"] as TrackType[]).map((track) => {
          const item = live?.tracks[track];
          return (
            <div className="live-item" key={track}>
              <strong>{track.toUpperCase()}</strong>
              <span>{item?.currentTimestamp ?? "Checking..."}</span>
              {item?.events.href ? (
                <a href={item.events.href} rel="noreferrer" target="_blank">
                  {item.events.text ?? "Events CSV"}
                </a>
              ) : (
                <small>Events CSV pending</small>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={onRefresh} type="button">
        Refresh
      </button>
      <small>{live ? `Checked ${formatCheckedAt(live.checkedAt)}` : "Pulls live metadata from mkwlounge.gg"}</small>
    </section>
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
  const [scoreRaceFilter, setScoreRaceFilter] = useState<RaceFilter>("12");
  const [rankRange, setRankRange] = useState<RangeFilter>("all");
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const trackData = data.byTrack[track];
  const trackName = track.toUpperCase();
  const rankYears = useMemo(
    () => [...new Set(trackData.timeline.flatMap((row) => [row.start.slice(0, 4), row.end.slice(0, 4)]))]
      .filter((year) => year >= "2021" && year <= "2026")
      .sort(),
    [trackData.timeline],
  );
  const rankWindow = useMemo(() => buildRankRange(trackData.timeline, rankRange), [trackData.timeline, rankRange]);
  const scoreRows = trackData.topScoresByRace[scoreRaceFilter];
  const lowScoreRows = trackData.lowScoresByRace[scoreRaceFilter];

  async function refreshLiveStatus() {
    try {
      const response = await fetch("/api/live", { cache: "no-store" });
      if (response.ok) {
        setLive((await response.json()) as LiveSnapshot);
      }
    } catch {
      setLive(null);
    }
  }

  useEffect(() => {
    void refreshLiveStatus();
  }, []);

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

      <LiveStatus live={live} onRefresh={refreshLiveStatus} />

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
            <span>{formatNumber(rankWindow.timeline.length)} lead segments</span>
          </div>
          <div className="panel-controls">
            <SegmentedControl
              label="Range"
              onChange={setRankRange}
              options={[
                { value: "all", label: "All time" },
                ...rankYears.map((year) => ({ value: year, label: year })),
              ]}
              value={rankRange}
            />
          </div>
          <Timeline rows={rankWindow.timeline} />
          <div className="split-grid">
            <div>
              <h3>Most Days at #1 · {rankWindow.label}</h3>
              <BarBoard rows={rankWindow.leaderboard.slice(0, 14)} suffix="d" />
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
              <h3 className="subchart-title">Events per Year</h3>
              <div className="year-chart">
                {trackData.volumeByYear.map((row) => (
                  <div className="month-row" key={row.label}>
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
            <div className="scroll-board">
              <BarBoard rows={trackData.allEventCounts} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">{trackName} Score Ceiling</p>
                <h2>Highest Event Scores · {scoreRaceFilter} Races</h2>
              </div>
            </div>
            <div className="panel-controls">
              <SegmentedControl
                label="Format"
                onChange={setScoreRaceFilter}
                options={[
                  { value: "12", label: "12 races" },
                  { value: "32", label: "32 races" },
                ]}
                value={scoreRaceFilter}
              />
            </div>
            <ScoreTable rows={scoreRows.slice(0, 10)} mode="high" />
          </div>

          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">{trackName} Score Floor</p>
                <h2>Lowest Event Scores · {scoreRaceFilter} Races</h2>
              </div>
            </div>
            <ScoreTable rows={lowScoreRows.slice(0, 10)} mode="low" />
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
                {row.returnEventUrl ? (
                  <a className="result-link return-link" href={row.returnEventUrl} rel="noreferrer" target="_blank">
                    View return event
                  </a>
                ) : null}
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

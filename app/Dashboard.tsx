"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import AlmiaUpperDashboard, { type AlmiaUpperData } from "./AlmiaUpperDashboard";

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
  id?: string;
  name: string;
  ranking: number;
  currentMmr: number;
  currentLr?: number;
  peakMmr: number;
  peakLr?: number;
  totalEvents: number;
  averageScore: number;
  division: string;
  className: string;
  url?: string;
};

type VolumeRow = {
  month?: string;
  year?: string;
  label: string;
  value: number;
  pct: number;
};

type DivisionRow = {
  name: string;
  value: number;
};

type CurrentLeaderboardRow = {
  id: string;
  name: string;
  ranking: number;
  currentMmr: number;
  currentLr: number;
  peakMmr: number;
  peakLr: number;
  totalEvents: number;
  wins: number;
  losses: number;
  winPercentage: number;
  averageScore: number;
  topScore: number;
  currentDivision: string;
  currentClass: string;
  url?: string;
};

type PlayerEventRow = {
  eventId: string;
  date: string;
  tier: string;
  format: string;
  rank: number;
  score: number;
  races: number;
  result: string;
  changeMmr: number;
  updatedMmr: number;
  changeLr: number;
  updatedLr: number;
  url: string;
};

type PlayerProfile = CurrentLeaderboardRow & {
  country: string;
  controller: string;
  lowestMmr: number;
  lowestLr: number;
  percentile: number;
  maxGainMmr: number;
  maxGainLr: number;
  maxLossMmr: number;
  maxLossLr: number;
  gainloss10Mmr: number;
  gainloss10Lr: number;
  wins10: number;
  loss10: number;
  win10Percentage: number;
  winStreak: number;
  average10Score: number;
  stdScore: number;
  std10Score: number;
  nosqWins: number;
  nosqLosses: number;
  nosqWinPercentage: number;
  nosqMaxGainMmr: number;
  nosqMaxGainLr: number;
  nosqMaxLossMmr: number;
  nosqMaxLossLr: number;
  nosqGainloss10Mmr: number;
  nosqGainloss10Lr: number;
  nosqWins10: number;
  nosqLoss10: number;
  nosqAverageScore: number;
  nosqAverage10Score: number;
  nosqStdScore: number;
  nosqStd10Score: number;
  nosqTopScore: number;
  nosqTotalEvents: number;
  currentDivision: string;
  currentClass: string;
  lastEventDate: string;
  updateDate: string;
  ladderId: number;
  trackType: TrackType;
  events: PlayerEventRow[];
};

type SpotlightRow = {
  id: string;
  name: string;
  value: number;
  events?: number;
  average10Score?: number;
};

type SeasonRange = {
  ladderId: number;
  label: string;
  start: string;
  end: string;
  displayStart: string;
  displayEnd: string;
  eventCount: number;
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
  seasonRanges: SeasonRange[];
  timeline: TimelineRow[];
  rankOneLeaderboard: RankOneRow[];
  currentTop: CurrentTopRow[];
  currentLeaderboard: CurrentLeaderboardRow[];
  playerProfiles: Record<string, PlayerProfile>;
  currentSpotlights: {
    bestAverageScore: SpotlightRow[];
    bestWinRate: SpotlightRow[];
    hottestLast10: SpotlightRow[];
  };
  allEventCounts: Array<{ id: string; name: string; value: number; currentMmr: number }>;
  topScores: ScoreRow[];
  lowScores: ScoreRow[];
  topScoresByRace: Record<"12" | "32", ScoreRow[]>;
  lowScoresByRace: Record<"12" | "32", ScoreRow[]>;
  biggestGains: ScoreRow[];
  biggestLosses: ScoreRow[];
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
  grandmastersByTrack: Record<TrackType, RtGrandmaster[]>;
  rtGrandmasters?: RtGrandmaster[];
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

const tabs = ["Overview", "Rank 1", "Records", "Leaderboard", "GMs", "Insights", "Almia Upper Result"] as const;
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

function formatDecimal(value = 0, digits = 1) {
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
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

function namedRange(range: RangeFilter, seasons: SeasonRange[]) {
  if (range === "all") {
    return null;
  }
  if (range.startsWith("season:")) {
    const ladderId = Number(range.replace("season:", ""));
    const season = seasons.find((item) => item.ladderId === ladderId);
    if (!season) {
      return null;
    }
    return {
      start: dateMs(season.start),
      end: dateMs(season.end) + dayMs,
      label: `${season.label} · ${season.displayStart} to ${season.displayEnd}`,
    };
  }
  return {
    ...yearRange(range),
    label: range,
  };
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

function MmrMoveTable({ gains, losses }: { gains: ScoreRow[]; losses: ScoreRow[] }) {
  const rows = [
    ...gains.map((row) => ({ ...row, direction: "Gain" })),
    ...losses.map((row) => ({ ...row, direction: "Loss" })),
  ];

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Player</th>
            <th>MMR +/-</th>
            <th>Score</th>
            <th>Races</th>
            <th>Event</th>
            <th>Date</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.direction}-${row.eventId}-${row.id}-${index}`}>
              <td>{row.direction}</td>
              <td>{row.name}</td>
              <td className={(row.mmrDelta ?? 0) >= 0 ? "positive" : "danger"}>{formatSigned(row.mmrDelta)}</td>
              <td>{row.value}</td>
              <td>{row.races}</td>
              <td>
                {row.type} <small>{row.tier}</small>
              </td>
              <td>{row.date ? shortDate(row.date) : "-"}</td>
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
  seasons: SeasonRange[],
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

  const selectedRange = namedRange(range, seasons);
  if (!selectedRange) {
    return buildRankRange(rows, "all", seasons);
  }

  const { start, end, label } = selectedRange;
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
    label,
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

function GrandmasterTable({ rows, trackName }: { rows: RtGrandmaster[]; trackName: string }) {
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
              <td>
                {trackName} S{row.firstSeason}
              </td>
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

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProfileStatBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="profile-stat-block">
      <h3>{title}</h3>
      <div className="mini-stat-grid">{children}</div>
    </div>
  );
}

function PlayerProfilePanel({ profile }: { profile: PlayerProfile | null }) {
  if (!profile) {
    return (
      <div className="player-empty">
        Select a player from the leaderboard to open their current-season profile and event log.
      </div>
    );
  }

  return (
    <div className="player-profile">
      <div className="profile-head">
        <div>
          <p className="eyebrow">
            #{profile.ranking} · {profile.trackType.toUpperCase()} S{profile.ladderId}
          </p>
          <h2>{profile.name}</h2>
          <span>
            {profile.currentDivision} · {profile.currentClass}
          </span>
        </div>
        <a className="result-link" href={profile.url} rel="noreferrer" target="_blank">
          Profile
        </a>
      </div>

      <div className="profile-grid">
        <ProfileStatBlock title="All Events">
          <MiniStat label="Wins" value={formatNumber(profile.wins)} />
          <MiniStat label="Losses" value={formatNumber(profile.losses)} />
          <MiniStat label="Win %" value={`${formatDecimal(profile.winPercentage)}%`} />
          <MiniStat label="Max LR Gain" value={formatSigned(profile.maxGainLr)} />
          <MiniStat label="Max LR Loss" value={formatSigned(profile.maxLossLr)} />
          <MiniStat label="LR" value={formatNumber(profile.currentLr)} />
          <MiniStat label="MMR" value={formatNumber(profile.currentMmr)} />
          <MiniStat label="Avg Score" value={formatDecimal(profile.averageScore)} />
          <MiniStat label="Std Dev Score" value={formatDecimal(profile.stdScore)} />
          <MiniStat label="Top Score" value={formatNumber(profile.topScore)} />
          <MiniStat label="Events" value={formatNumber(profile.totalEvents)} />
        </ProfileStatBlock>

        <ProfileStatBlock title="Last 10">
          <MiniStat label="Win Streak" value={formatSigned(profile.winStreak)} />
          <MiniStat label="Wins" value={formatNumber(profile.wins10)} />
          <MiniStat label="Losses" value={formatNumber(profile.loss10)} />
          <MiniStat label="Average" value={formatDecimal(profile.average10Score)} />
          <MiniStat label="Std Dev" value={formatDecimal(profile.std10Score)} />
          <MiniStat label="MMR +/-" value={formatSigned(profile.gainloss10Mmr)} />
          <MiniStat label="LR +/-" value={formatSigned(profile.gainloss10Lr)} />
        </ProfileStatBlock>

        <ProfileStatBlock title="No Squad Queue Events">
          <MiniStat label="Wins" value={formatNumber(profile.nosqWins)} />
          <MiniStat label="Losses" value={formatNumber(profile.nosqLosses)} />
          <MiniStat label="Win %" value={`${formatDecimal(profile.nosqWinPercentage)}%`} />
          <MiniStat label="Max LR Gain" value={formatSigned(profile.nosqMaxGainLr)} />
          <MiniStat label="Max LR Loss" value={formatSigned(profile.nosqMaxLossLr)} />
          <MiniStat label="Avg Score" value={formatDecimal(profile.nosqAverageScore)} />
          <MiniStat label="Std Dev Score" value={formatDecimal(profile.nosqStdScore)} />
          <MiniStat label="Top Score" value={formatNumber(profile.nosqTopScore)} />
          <MiniStat label="Events" value={formatNumber(profile.nosqTotalEvents)} />
        </ProfileStatBlock>

        <ProfileStatBlock title="No SQ Last 10">
          <MiniStat label="Wins" value={formatNumber(profile.nosqWins10)} />
          <MiniStat label="Losses" value={formatNumber(profile.nosqLoss10)} />
          <MiniStat label="Average" value={formatDecimal(profile.nosqAverage10Score)} />
          <MiniStat label="Std Dev" value={formatDecimal(profile.nosqStd10Score)} />
          <MiniStat label="MMR +/-" value={formatSigned(profile.nosqGainloss10Mmr)} />
          <MiniStat label="LR +/-" value={formatSigned(profile.nosqGainloss10Lr)} />
        </ProfileStatBlock>
      </div>

      <div className="table-wrap profile-events">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Tier</th>
              <th>Format</th>
              <th>Rank</th>
              <th>Score</th>
              <th>Races Played</th>
              <th>Result</th>
              <th>MMR +/-</th>
              <th>MMR</th>
              <th>LR +/-</th>
              <th>LR</th>
              <th>Event</th>
            </tr>
          </thead>
          <tbody>
            {profile.events.map((event, index) => (
              <tr key={`${event.eventId}-${index}`}>
                <td>{index + 1}</td>
                <td>{shortDate(event.date)}</td>
                <td>{event.tier}</td>
                <td>{event.format}</td>
                <td>{event.rank}</td>
                <td>{event.score}</td>
                <td>{event.races}</td>
                <td className={event.result === "Win" ? "positive" : ""}>{event.result}</td>
                <td className={event.changeMmr >= 0 ? "positive" : "danger"}>{formatSigned(event.changeMmr)}</td>
                <td>{formatNumber(event.updatedMmr)}</td>
                <td className={event.changeLr >= 0 ? "positive" : "danger"}>{formatSigned(event.changeLr)}</td>
                <td>{formatNumber(event.updatedLr)}</td>
                <td>
                  <a className="result-link" href={event.url} rel="noreferrer" target="_blank">
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerLeaderboard({
  rows,
  selectedId,
  onSelect,
}: {
  rows: CurrentLeaderboardRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="table-wrap leaderboard-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>LR</th>
            <th>MMR</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Win %</th>
            <th>Avg</th>
            <th>Top</th>
            <th>Events</th>
            <th>Division</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              className={selectedId === row.id ? "selected" : ""}
              key={row.id}
              onClick={() => onSelect(row.id)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onSelect(row.id);
                }
              }}
            >
              <td>{row.ranking}</td>
              <td>{row.name}</td>
              <td className="positive">{formatNumber(row.currentLr)}</td>
              <td>{formatNumber(row.currentMmr)}</td>
              <td>{formatNumber(row.wins)}</td>
              <td>{formatNumber(row.losses)}</td>
              <td>{formatDecimal(row.winPercentage)}%</td>
              <td>{formatDecimal(row.averageScore)}</td>
              <td>{formatNumber(row.topScore)}</td>
              <td>{formatNumber(row.totalEvents)}</td>
              <td>
                {row.currentDivision} <small>{row.currentClass}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpotlightList({
  rows,
  suffix = "",
  valueLabel,
  signed = false,
}: {
  rows: SpotlightRow[];
  suffix?: string;
  valueLabel?: string;
  signed?: boolean;
}) {
  return (
    <div className="spotlight-list">
      {rows.map((row, index) => (
        <div className="spotlight-row" key={`${row.id}-${index}`}>
          <span>{index + 1}</span>
          <strong>{row.name}</strong>
          <b>
            {signed ? formatSigned(row.value) : formatNumber(row.value)}
            {suffix}
          </b>
          {valueLabel ? <small>{valueLabel}</small> : null}
          {row.events ? <small>{formatNumber(row.events)} events</small> : null}
          {row.average10Score ? <small>{formatDecimal(row.average10Score)} avg last 10</small> : null}
        </div>
      ))}
    </div>
  );
}

function CreditsPanel({ sourceTimestamp }: { sourceTimestamp: string }) {
  return (
    <section className="panel wide credits-panel" id="credits">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Credits</p>
          <h2>Data, sourcing, and build credits</h2>
        </div>
      </div>
      <div className="credits-grid">
        <article>
          <h3>MKW Lounge Data</h3>
          <p>
            All ladder data, player records, event exports, ranks, MMR/LR values, and event result links are sourced
            from MKW Lounge. This dashboard is an independent visualization layer built on top of those public exports.
          </p>
          <a className="result-link" href="https://www.mkwlounge.gg/" rel="noreferrer" target="_blank">
            Open MKW Lounge
          </a>
        </article>
        <article>
          <h3>MKWii Lounge Discord</h3>
          <p>Join the MKWii Lounge community through the official Discord invite.</p>
          <a className="result-link" href="https://discord.gg/mkw" rel="noreferrer" target="_blank">
            Join Discord
          </a>
        </article>
        <article>
          <h3>Website</h3>
          <p>Website created by Jay. Data snapshot shown here: {sourceTimestamp}.</p>
        </article>
      </div>
    </section>
  );
}

function DashboardLoaded({ data, almia }: { data: DashboardData; almia: AlmiaUpperData | null }) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [track, setTrack] = useState<TrackType>("rt");
  const [topRaceFilter, setTopRaceFilter] = useState<RaceFilter>("12");
  const [lowRaceFilter, setLowRaceFilter] = useState<RaceFilter>("32");
  const [rankRange, setRankRange] = useState<RangeFilter>("all");
  const [leaderboardQuery, setLeaderboardQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const trackData = data.byTrack[track];
  const trackName = track.toUpperCase();
  const grandmasters = data.grandmastersByTrack?.[track] ?? (track === "rt" ? data.rtGrandmasters ?? [] : []);
  const rankYears = useMemo(
    () => [...new Set(trackData.timeline.flatMap((row) => [row.start.slice(0, 4), row.end.slice(0, 4)]))]
      .filter((year) => year >= "2021" && year <= "2026")
      .sort(),
    [trackData.timeline],
  );
  const seasonOptions = useMemo(
    () =>
      trackData.seasonRanges
        .slice()
        .sort((a, b) => b.ladderId - a.ladderId)
        .map((season) => ({
          value: `season:${season.ladderId}`,
          label: `S${season.ladderId}`,
        })),
    [trackData.seasonRanges],
  );
  const rankWindow = useMemo(
    () => buildRankRange(trackData.timeline, rankRange, trackData.seasonRanges),
    [trackData.timeline, trackData.seasonRanges, rankRange],
  );
  const scoreRows = trackData.topScoresByRace[topRaceFilter];
  const lowScoreRows = trackData.lowScoresByRace[lowRaceFilter];
  const filteredLeaderboard = useMemo(() => {
    const query = leaderboardQuery.trim().toLowerCase();
    if (!query) {
      return trackData.currentLeaderboard;
    }
    return trackData.currentLeaderboard.filter((row) => row.name.toLowerCase().includes(query));
  }, [leaderboardQuery, trackData.currentLeaderboard]);
  const selectedProfile = useMemo(() => {
    const fallbackId = filteredLeaderboard[0]?.id ?? trackData.currentLeaderboard[0]?.id ?? null;
    return trackData.playerProfiles[selectedPlayerId ?? fallbackId] ?? null;
  }, [filteredLeaderboard, selectedPlayerId, trackData.currentLeaderboard, trackData.playerProfiles]);

  function changeTrack(nextTrack: TrackType) {
    setTrack(nextTrack);
    setRankRange("all");
    setLeaderboardQuery("");
    setSelectedPlayerId(null);
  }

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
    let cancelled = false;
    void fetch("/api/live", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<LiveSnapshot> : null)
      .then((snapshot) => {
        if (!cancelled && snapshot) {
          setLive(snapshot);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLive(null);
        }
      });
    return () => {
      cancelled = true;
    };
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
        <a href="#credits">
          <img alt="" src="/csv.svg" />
          Credits
        </a>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-topline">
            <p className="eyebrow">
              {trackName} · Ladder {trackData.meta.currentLadderId}
            </p>
            <TrackSwitch track={track} onTrackChange={changeTrack} />
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
              {tab === "GMs" ? `${trackName} GMs` : tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Almia Upper Result" && <AlmiaUpperDashboard data={almia} />}

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
                ...seasonOptions,
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
                <h2>Highest Event Scores · {topRaceFilter} Races</h2>
              </div>
            </div>
            <div className="panel-controls">
              <SegmentedControl
                label="Format"
                onChange={setTopRaceFilter}
                options={[
                  { value: "12", label: "12 races" },
                  { value: "32", label: "32 races" },
                ]}
                value={topRaceFilter}
              />
            </div>
            <ScoreTable rows={scoreRows.slice(0, 10)} mode="high" />
          </div>

          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">{trackName} Score Floor</p>
                <h2>Lowest Event Scores · {lowRaceFilter} Races</h2>
              </div>
            </div>
            <div className="panel-controls">
              <SegmentedControl
                label="Format"
                onChange={setLowRaceFilter}
                options={[
                  { value: "12", label: "12 races" },
                  { value: "32", label: "32 races" },
                ]}
                value={lowRaceFilter}
              />
            </div>
            <ScoreTable rows={lowScoreRows.slice(0, 10)} mode="low" />
          </div>
        </section>
      )}

      {activeTab === "Leaderboard" && (
        <section className="panel wide" id="leaderboard">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{trackName} Current Season</p>
              <h2>Full Player Leaderboard</h2>
            </div>
            <span>{formatNumber(trackData.currentLeaderboard.length)} ranked players</span>
          </div>
          <div className="leaderboard-tools">
            <input
              aria-label="Search player leaderboard"
              onChange={(event) => setLeaderboardQuery(event.target.value)}
              placeholder="Search player..."
              type="search"
              value={leaderboardQuery}
            />
          </div>
          <PlayerLeaderboard
            rows={filteredLeaderboard}
            selectedId={selectedProfile?.id ?? null}
            onSelect={setSelectedPlayerId}
          />
          <PlayerProfilePanel profile={selectedProfile} />
        </section>
      )}

      {(activeTab === "Overview" || activeTab === "GMs") && (
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{trackName} Grandmaster</p>
              <h2>Players Who Hit {trackName} Grandmaster All Time</h2>
            </div>
            <span>{formatNumber(grandmasters.length)} players</span>
          </div>
          <GrandmasterTable rows={grandmasters} trackName={trackName} />
        </section>
      )}

      {(activeTab === "Overview" || activeTab === "Insights") && (
        <section className="insights-grid">
          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">{trackName} Consistency</p>
                <h2>Best Average Score</h2>
              </div>
            </div>
            <SpotlightList rows={trackData.currentSpotlights.bestAverageScore} />
          </div>

          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">{trackName} Conversion</p>
                <h2>Best Win Rate</h2>
              </div>
            </div>
            <SpotlightList rows={trackData.currentSpotlights.bestWinRate} suffix="%" />
          </div>

          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">{trackName} Last 10</p>
                <h2>Hottest Recent Runs</h2>
                <p className="panel-note">Ranked by net MMR gained over each player&apos;s last 10 current-season events.</p>
              </div>
            </div>
            <SpotlightList
              rows={trackData.currentSpotlights.hottestLast10}
              signed
              valueLabel="Last 10 MMR +/-"
            />
          </div>

          <div className="panel">
            <div className="panel-head compact">
              <div>
                <p className="eyebrow">{trackName} Swings</p>
                <h2>Biggest Event MMR Moves</h2>
              </div>
            </div>
            <MmrMoveTable gains={trackData.biggestGains.slice(0, 5)} losses={trackData.biggestLosses.slice(0, 5)} />
          </div>
        </section>
      )}

      {activeTab === "Overview" && (
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
      )}

      {(activeTab === "Overview" || activeTab === "Insights") && (
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

      <CreditsPanel sourceTimestamp={data.meta.sourceTimestamp} />

      <footer>
        Data snapshot from MKW Lounge: {data.meta.sourceTimestamp}. Rank-one history uses exported event MMR updates
        and resets within each ladder season. All ladder exports and event result links are sourced from MKW Lounge.
      </footer>
    </main>
  );
}

function LoadingDashboard() {
  return (
    <main>
      <div className="earth-content">
        <div id="earth" />
      </div>
      <nav className="lounge-nav" aria-label="MKW Lounge dashboard navigation">
        <a className="nav-brand" href="https://mkwlounge.gg/ladder/index.php?ladder_id=19&hide_unranked=0">
          MKW Lounge
        </a>
        <a href="#rank-one">
          <img alt="" src="/history.svg" />
          Rank 1
        </a>
        <a href="#records">
          <img alt="" src="/statistics.svg" />
          Records
        </a>
        <a href="#credits">
          <img alt="" src="/csv.svg" />
          Credits
        </a>
      </nav>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">RT · CT</p>
          <h1>MKW Lounge All-Time Ladder Lab</h1>
          <p>Loading the all-time ladder export and current-season leaderboards.</p>
        </div>
        <div className="rank-one-card">
          <span>Data snapshot</span>
          <strong>Loading</strong>
          <div>Fetching stats from the generated dashboard dataset.</div>
        </div>
      </section>
    </main>
  );
}

export default function Dashboard({ data: initialData }: { data?: DashboardData }) {
  const [data, setData] = useState<DashboardData | null>(initialData ?? null);
  const [almia, setAlmia] = useState<AlmiaUpperData | null>(null);

  useEffect(() => {
    let mounted = true;
    const dashboardRequest = initialData
      ? Promise.resolve(initialData)
      : fetch("/dashboard-data.json", { cache: "no-store" }).then((response) => response.ok ? response.json() : null);
    const tournamentRequest = fetch("/almia-upper-data.json", { cache: "no-store" }).then((response) => response.ok ? response.json() : null);
    void Promise.all([dashboardRequest, tournamentRequest])
      .then(([nextData, tournamentData]) => {
        if (mounted) {
          if (nextData) setData(nextData as DashboardData);
          if (tournamentData) setAlmia(tournamentData as AlmiaUpperData);
        }
      })
      .catch(() => {
        if (mounted) {
          setData(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [initialData]);

  if (!data) {
    return <LoadingDashboard />;
  }

  return <DashboardLoaded almia={almia} data={data} />;
}

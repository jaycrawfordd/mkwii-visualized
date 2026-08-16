"use client";

import { useMemo, useState } from "react";

type TrackType = "rt" | "ct";
type SeasonLeaderboardRow = {
  id: string; name: string; rank: number; mmr: number; lr: number; peakMmr: number; peakLr: number; events: number;
  wins: number; losses: number; winRate: number; averageScore: number; topScore: number; division: string;
  previousPeakMmr: number | null; newPeakGain: number; url: string;
};
type MovementRow = {
  id: string; name: string; startMmr: number; endMmr: number; startLr: number; endLr: number; mmrChange: number;
  lrChange: number; events: number; wins: number; averageScore: number; url: string;
};
type EventSwing = { id: string; name: string; value: number; score: number; date: string; eventId: string; url: string };
type Season = {
  meta: { ladderId: number; track: TrackType; label: string; current: boolean; start: string; end: string; eventCount: number; playerCount: number; sourceUrl: string };
  summary: { champion: SeasonLeaderboardRow | null; averageMmr: number; totalEntries: number; uniqueCompetitors: number };
  leaderboard: SeasonLeaderboardRow[];
  improvements: SeasonLeaderboardRow[];
  greatestGains: MovementRow[];
  greatestFalls: MovementRow[];
  mostEvents: MovementRow[];
  divisionHits: Array<{ id: string; name: string; division: string; date: string; mmr: number; lr: number; url: string }>;
  largestMmrGains: EventSwing[]; largestMmrLosses: EventSwing[]; largestLrGains: EventSwing[]; largestLrLosses: EventSwing[];
  teammatePairs: Array<{ playerA: { id: string; name: string }; playerB: { id: string; name: string }; events: number }>;
  rankDistribution: Array<{ division: string; value: number }>;
  bans: Array<{ player: string; date: string; dateLabel: string; datePrecision: string; length: string; reason: string }>;
  extraRecords: { mostWins: MovementRow[]; bestAverageScore: MovementRow[] };
};
export type SeasonalData = { meta: { generatedAt: string; note: string }; seasons: Season[] };

const fmt = (value: number | null | undefined) => Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(value as number) : "-";
const signed = (value: number) => `${value > 0 ? "+" : ""}${fmt(value)}`;
const prettyDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

function SeasonStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="season-stat"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function MovementList({ rows, mode }: { rows: MovementRow[]; mode: "gain" | "fall" }) {
  return <div className="season-list">{rows.slice(0, 12).map((row, index) => <article key={row.id}>
    <b>{index + 1}</b><div><strong>{row.name}</strong><small>{fmt(row.startMmr)} to {fmt(row.endMmr)} MMR · {row.events} events</small></div>
    <span className={mode === "gain" ? "positive" : "negative"}>{signed(row.mmrChange)}</span>
  </article>)}</div>;
}

function EventSwingList({ rows, metric }: { rows: EventSwing[]; metric: "MMR" | "LR" }) {
  return <div className="season-list compact-list">{rows.slice(0, 8).map((row, index) => <article key={`${row.eventId}-${row.id}`}>
    <b>{index + 1}</b><div><strong>{row.name}</strong><small>{prettyDate(row.date)} · {row.score} points</small></div>
    <a className={row.value >= 0 ? "positive" : "negative"} href={row.url} rel="noreferrer" target="_blank">{signed(row.value)} {metric}</a>
  </article>)}</div>;
}

function DivisionCurve({ rows }: { rows: Season["rankDistribution"] }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <div className="season-division-curve" aria-label="End-of-season rank distribution">{rows.map((row) => <div key={row.division}>
    <b>{fmt(row.value)}</b><span><i style={{ height: `${Math.max(2, row.value / max * 100)}%` }} /></span><small>{row.division}</small>
  </div>)}</div>;
}

export default function SeasonalDashboard({ data, track }: { data: SeasonalData | null; track: TrackType }) {
  const seasons = useMemo(() => data?.seasons.filter((season) => season.meta.track === track).sort((a, b) => b.meta.ladderId - a.meta.ladderId) || [], [data, track]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [swingMetric, setSwingMetric] = useState<"MMR" | "LR">("MMR");
  const defaultSeasonId = seasons.find((season) => season.meta.current)?.meta.ladderId ?? seasons[0]?.meta.ladderId ?? null;
  const effectiveSeasonId = seasons.some((season) => season.meta.ladderId === selectedId) ? selectedId : defaultSeasonId;
  const season = seasons.find((candidate) => candidate.meta.ladderId === effectiveSeasonId) || seasons[0];
  const visibleLeaderboard = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value && season ? season.leaderboard.filter((row) => row.name.toLowerCase().includes(value)) : season?.leaderboard || [];
  }, [query, season]);
  if (!data || !season) return <section className="panel wide season-loading">Loading seasonal history.</section>;
  const masterHits = season.divisionHits.filter((row) => row.division === "Master");
  const gmHits = season.divisionHits.filter((row) => row.division === "Grandmaster");
  const gainEvents = swingMetric === "MMR" ? season.largestMmrGains : season.largestLrGains;
  const lossEvents = swingMetric === "MMR" ? season.largestMmrLosses : season.largestLrLosses;

  return <section className="season-dashboard" aria-label={`${season.meta.label} seasonal dashboard`}>
    <div className="season-selector" role="tablist" aria-label={`${track.toUpperCase()} seasons`}>{seasons.map((row) => <button aria-selected={row.meta.ladderId === season.meta.ladderId} className={row.meta.ladderId === season.meta.ladderId ? "active" : ""} key={row.meta.ladderId} onClick={() => { setSelectedId(row.meta.ladderId); setQuery(""); }} role="tab" type="button">S{row.meta.ladderId}{row.meta.current ? <small>Current</small> : null}</button>)}</div>

    <header className="panel wide season-head"><div><p className="eyebrow">{season.meta.current ? "Current Season" : "Season Archive"}</p><h2>{season.meta.label}</h2><p>{prettyDate(season.meta.start)} to {prettyDate(season.meta.end)} · boundaries reconstructed from exported events</p></div>
      <div className="season-champion"><span>Season Leader</span><strong>{season.summary.champion?.name || "-"}</strong><b>{fmt(season.summary.champion?.mmr)} MMR · {fmt(season.summary.champion?.lr)} LR</b><a href={season.meta.sourceUrl} rel="noreferrer" target="_blank">Open source leaderboard</a></div></header>

    <div className="season-stats">
      <SeasonStat label="Events" value={fmt(season.meta.eventCount)} detail={`${fmt(season.summary.totalEntries)} player entries`} />
      <SeasonStat label="Ranked Players" value={fmt(season.meta.playerCount)} detail={`${fmt(season.summary.uniqueCompetitors)} event participants`} />
      <SeasonStat label="Average MMR" value={fmt(season.summary.averageMmr)} detail="end-of-season field" />
      <SeasonStat label="Master / GM" value={`${masterHits.length} / ${gmHits.length}`} detail="players recorded in division" />
      <SeasonStat label="Ban Log" value={fmt(season.bans.length)} detail="entries dated within season" />
    </div>

    <p className="season-method">Season movement compares each player&apos;s rating before their first exported event with their rating after their last exported event. Career-high improvement compares the selected season&apos;s peak with that player&apos;s best peak in earlier seasons.</p>

    <div className="season-two-column">
      <section className="panel"><div className="panel-head compact"><div><p className="eyebrow">Season Movement</p><h2>Greatest MMR gains</h2></div></div><MovementList rows={season.greatestGains} mode="gain" /></section>
      <section className="panel"><div className="panel-head compact"><div><p className="eyebrow">Season Movement</p><h2>Greatest MMR falls</h2></div></div><MovementList rows={season.greatestFalls} mode="fall" /></section>
    </div>

    <section className="panel wide"><div className="panel-head"><div><p className="eyebrow">End-State Distribution</p><h2>Player rank bell curve</h2></div><span>{fmt(season.meta.playerCount)} ranked players</span></div><DivisionCurve rows={season.rankDistribution} /></section>

    <div className="season-two-column">
      <section className="panel"><div className="panel-head compact"><div><p className="eyebrow">New Career Highs</p><h2>Largest peak improvements</h2></div><span>vs. prior seasons</span></div><div className="season-list">{season.improvements.slice(0, 12).map((row, index) => <article key={row.id}><b>{index + 1}</b><div><strong>{row.name}</strong><small>{fmt(row.previousPeakMmr)} previous · {fmt(row.peakMmr)} new peak</small></div><span className="positive">+{fmt(row.newPeakGain)}</span></article>)}</div></section>
      <section className="panel"><div className="panel-head compact"><div><p className="eyebrow">Volume Leaders</p><h2>Most events played</h2></div></div><div className="season-list">{season.mostEvents.slice(0, 12).map((row, index) => <article key={row.id}><b>{index + 1}</b><div><strong>{row.name}</strong><small>{row.wins} wins · {row.averageScore} avg score</small></div><span>{fmt(row.events)}</span></article>)}</div></section>
    </div>

    <section className="panel wide"><div className="panel-head"><div><p className="eyebrow">Season Leaders</p><h2>Wins and scoring consistency</h2></div><span>additional records</span></div><div className="season-two-column inset"><div><h3>Most wins</h3><div className="season-list compact-list">{season.extraRecords.mostWins.slice(0, 8).map((row, index) => <article key={row.id}><b>{index + 1}</b><div><strong>{row.name}</strong><small>{row.events} events · {row.averageScore} avg score</small></div><span>{fmt(row.wins)}</span></article>)}</div></div><div><h3>Best average score</h3><div className="season-list compact-list">{season.extraRecords.bestAverageScore.slice(0, 8).map((row, index) => <article key={row.id}><b>{index + 1}</b><div><strong>{row.name}</strong><small>{row.events} events · {row.wins} wins</small></div><span>{row.averageScore}</span></article>)}</div></div></div></section>

    <section className="panel wide"><div className="panel-head"><div><p className="eyebrow">Single Event Extremes</p><h2>Largest rating swings</h2></div><div className="metric-switch"><button className={swingMetric === "MMR" ? "active" : ""} onClick={() => setSwingMetric("MMR")} type="button">MMR</button><button className={swingMetric === "LR" ? "active" : ""} onClick={() => setSwingMetric("LR")} type="button">LR</button></div></div><div className="season-two-column inset"><div><h3>Biggest gains</h3><EventSwingList metric={swingMetric} rows={gainEvents} /></div><div><h3>Biggest losses</h3><EventSwingList metric={swingMetric} rows={lossEvents} /></div></div></section>

    <div className="season-two-column">
      <section className="panel"><div className="panel-head compact"><div><p className="eyebrow">Division Milestones</p><h2>Master and Grandmaster</h2></div><span>{season.divisionHits.length} records</span></div><div className="milestone-list">{season.divisionHits.map((row) => <article key={`${row.id}-${row.division}`}><span className={row.division === "Grandmaster" ? "gm" : "master"}>{row.division}</span><div><strong>{row.name}</strong><small>{prettyDate(row.date)} · {fmt(row.mmr)} MMR</small></div><a href={row.url} rel="noreferrer" target="_blank">Event</a></article>)}</div></section>
      <section className="panel"><div className="panel-head compact"><div><p className="eyebrow">Most Familiar Teammates</p><h2>Most-shared teammates</h2></div></div><div className="season-list teammate-list">{season.teammatePairs.map((row, index) => <article key={`${row.playerA.id}-${row.playerB.id}`}><b>{index + 1}</b><div><strong>{row.playerA.name} + {row.playerB.name}</strong><small>same team in exported events</small></div><span>{fmt(row.events)}</span></article>)}</div></section>
    </div>

    <section className="panel wide"><div className="panel-head"><div><p className="eyebrow">Static Community Log</p><h2>Players banned during this season</h2></div><span>{season.bans.length} entries</span></div><p className="season-note">This supplied log is not dynamic and may not reflect early unbans. Year-only dates are assigned using January 1 for seasonal grouping.</p><div className="ban-grid">{season.bans.length ? season.bans.map((ban) => <article key={`${ban.player}-${ban.date}-${ban.reason}`}><div><strong>{ban.player}</strong><time>{ban.datePrecision === "day" ? prettyDate(ban.date) : ban.dateLabel}</time></div><b>{ban.length}</b><p>{ban.reason}</p></article>) : <p className="empty-copy">No supplied ban-log entries fall inside this season.</p>}</div></section>

    <section className="panel wide"><div className="panel-head"><div><p className="eyebrow">Season Standings</p><h2>{season.meta.current ? "Current" : "Final"} leaderboard</h2></div><span>{visibleLeaderboard.length} shown</span></div><div className="leaderboard-tools"><input aria-label="Search seasonal leaderboard" onChange={(event) => setQuery(event.target.value)} placeholder="Search season player..." type="search" value={query} /></div><div className="table-wrap season-table"><table><thead><tr><th>#</th><th>Player</th><th>MMR</th><th>LR</th><th>Peak MMR</th><th>Events</th><th>W-L</th><th>Win %</th><th>Avg</th><th>Top</th><th>Division</th><th>Profile</th></tr></thead><tbody>{visibleLeaderboard.map((row) => <tr key={row.id}><td>{row.rank}</td><td>{row.name}</td><td className="positive">{fmt(row.mmr)}</td><td>{fmt(row.lr)}</td><td>{fmt(row.peakMmr)}</td><td>{fmt(row.events)}</td><td>{row.wins}-{row.losses}</td><td>{row.winRate}%</td><td>{row.averageScore}</td><td>{row.topScore}</td><td>{row.division}</td><td><a className="result-link" href={row.url} rel="noreferrer" target="_blank">Open</a></td></tr>)}</tbody></table></div></section>
  </section>;
}

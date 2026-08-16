"use client";

import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TrackType = "rt" | "ct";
type Metric = "lr" | "mmr";

export type RankingCloudPlayer = {
  id: string;
  name: string;
  ranking: number;
  currentMmr: number;
  currentLr: number;
  peakMmr: number;
  totalEvents: number;
  currentDivision: string;
  url?: string;
};

export type RankingCloudProfile = {
  avatarUrl?: string;
  emblem?: string;
  percentile?: number;
};

type LayoutPlayer = RankingCloudPlayer & {
  lane: number;
  rating: number;
  x: number;
  y: number;
};

const divisions = [
  { name: "Iron", min: 0 },
  { name: "Copper", min: 1250 },
  { name: "Bronze", min: 2500 },
  { name: "Silver", min: 4000 },
  { name: "Gold", min: 5500 },
  { name: "Platinum", min: 7000 },
  { name: "Emerald", min: 8250 },
  { name: "Ruby", min: 9500 },
  { name: "Diamond", min: 11000 },
  { name: "Master", min: 13000 },
  { name: "Grandmaster", min: 14000 },
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ratingFor(player: RankingCloudPlayer, metric: Metric) {
  return metric === "lr" ? player.currentLr : player.currentMmr;
}

function axisPosition(value: number, minimum: number, maximum: number) {
  return 5 + ((value - minimum) / Math.max(1, maximum - minimum)) * 90;
}

function buildScale(players: RankingCloudPlayer[], metric: Metric) {
  const ratings = players.map((player) => ratingFor(player, metric));
  const rawMin = Math.min(...ratings);
  const rawMax = Math.max(...ratings);
  const range = Math.max(1000, rawMax - rawMin);
  const minimum = Math.max(0, Math.floor((rawMin - range * 0.04) / 1000) * 1000);
  const maximum = Math.ceil((rawMax + range * 0.04) / 1000) * 1000;
  const targetStep = (maximum - minimum) / 6;
  const step = [500, 1000, 2000, 2500, 5000].find((candidate) => candidate >= targetStep) || 5000;
  const ticks: number[] = [];
  for (let value = Math.ceil(minimum / step) * step; value <= maximum; value += step) ticks.push(value);
  if (ticks[0] !== minimum) ticks.unshift(minimum);
  if (ticks.at(-1) !== maximum) ticks.push(maximum);
  return { minimum, maximum, ticks };
}

function buildLayout(players: RankingCloudPlayer[], metric: Metric, minimum: number, maximum: number) {
  const placed: LayoutPlayer[] = [];
  const sorted = players.slice().sort((a, b) => ratingFor(a, metric) - ratingFor(b, metric) || a.ranking - b.ranking);
  for (const player of sorted) {
    const hash = stableHash(`${player.id}-${metric}`);
    const jitter = ((hash % 1000) / 1000 - 0.5) * 1.25;
    const x = Math.max(4.5, Math.min(95.5, axisPosition(ratingFor(player, metric), minimum, maximum) + jitter));
    let lane = 0;
    while (placed.some((row) => row.lane === lane && Math.abs(row.x - x) < 3.6)) lane += 1;
    const verticalJitter = (((hash >>> 12) % 7) - 3) * 0.32;
    placed.push({ ...player, lane, rating: ratingFor(player, metric), x, y: 78 - lane * 7.7 + verticalJitter });
  }
  return placed;
}

function avatarStyle(profile?: RankingCloudProfile): CSSProperties {
  const source = profile?.avatarUrl || "/mii-placeholder.png";
  return { backgroundImage: `url("${source}")` };
}

export default function WorldwideRankingCloud({
  ladderId,
  players,
  profiles,
  totalPlayers,
  track,
}: {
  ladderId: number;
  players: RankingCloudPlayer[];
  profiles: Record<string, RankingCloudProfile>;
  totalPlayers: number;
  track: TrackType;
}) {
  const topPlayers = useMemo(() => players.slice(0, 50), [players]);
  const [metric, setMetric] = useState<Metric>("lr");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scale = useMemo(() => buildScale(topPlayers, metric), [metric, topPlayers]);
  const layout = useMemo(() => buildLayout(topPlayers, metric, scale.minimum, scale.maximum), [metric, scale.maximum, scale.minimum, topPlayers]);
  const selectedPlayer = topPlayers.find((player) => player.id === selectedId) || topPlayers[0];
  const tooltipId = hoveredId || selectedPlayer?.id;
  const suggestions = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value || selectedPlayer?.name.toLowerCase() === value) return [];
    return topPlayers.filter((player) => player.name.toLowerCase().includes(value)).slice(0, 6);
  }, [query, selectedPlayer, topPlayers]);
  const selectedPercentile = selectedPlayer
    ? profiles[selectedPlayer.id]?.percentile ?? ((totalPlayers - selectedPlayer.ranking) / Math.max(1, totalPlayers)) * 100
    : 0;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !selectedPlayer) return;
    const marker = container.querySelector<HTMLElement>(`[data-player-id="${selectedPlayer.id}"]`);
    if (!marker) return;
    const target = marker.offsetLeft - container.clientWidth / 2 + marker.clientWidth / 2;
    container.scrollTo({ behavior: "smooth", left: Math.max(0, target) });
  }, [metric, selectedPlayer]);

  const selectPlayer = (player: RankingCloudPlayer) => {
    setSelectedId(player.id);
    setQuery(player.name);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim().toLowerCase();
    const player = topPlayers.find((row) => row.name.toLowerCase() === value) || suggestions[0];
    if (player) selectPlayer(player);
  };

  if (!selectedPlayer) return <section className="wr-cloud-shell wr-cloud-loading">Loading worldwide rankings.</section>;

  return <section className="wr-cloud-shell" aria-label={`${track.toUpperCase()} top 50 worldwide ranking cloud`}>
    <header className="wr-cloud-header">
      <span className="ww-checkers" aria-hidden="true" />
      <div><small>{track.toUpperCase()} Season {ladderId}</small><strong>Worldwide Ranking</strong></div>
      <span className="ww-checkers" aria-hidden="true" />
    </header>

    <div className="wr-cloud-toolbar">
      <button aria-label="Previous rating metric" onClick={() => setMetric(metric === "lr" ? "mmr" : "lr")} title="Previous rating metric" type="button">&larr;</button>
      <div><small>Rating axis</small><strong>{metric.toUpperCase()}</strong></div>
      <button aria-label="Next rating metric" onClick={() => setMetric(metric === "lr" ? "mmr" : "lr")} title="Next rating metric" type="button">&rarr;</button>
      <form onSubmit={submitSearch}>
        <label htmlFor="worldwide-player-search">Find a top 50 player</label>
        <div><input autoComplete="off" id="worldwide-player-search" onChange={(event) => setQuery(event.target.value)} placeholder="Type a Lounge name..." type="search" value={query} /><button type="submit">Find</button></div>
        {suggestions.length ? <div className="wr-cloud-suggestions">{suggestions.map((player) => <button key={player.id} onClick={() => selectPlayer(player)} type="button"><span className="wr-cloud-avatar mini" style={avatarStyle(profiles[player.id])} /><span><strong>{player.name}</strong><small>#{player.ranking} · {formatNumber(player.currentLr)} LR</small></span></button>)}</div> : null}
      </form>
    </div>

    <div className="wr-cloud-viewport" ref={scrollRef}>
      <div className="wr-cloud-stage">
        <div className="wr-cloud-stars" />
        <div className="wr-cloud-earth" />

        {metric === "lr" ? <div className="wr-cloud-rank-bands">{divisions.map((division, index) => {
          const nextMinimum = divisions[index + 1]?.min ?? scale.maximum;
          const start = Math.max(scale.minimum, division.min);
          const end = Math.min(scale.maximum, nextMinimum);
          if (end <= start) return null;
          return <span className={`rank-${division.name.toLowerCase()}`} key={division.name} style={{ left: `${axisPosition(start, scale.minimum, scale.maximum)}%`, width: `${axisPosition(end, scale.minimum, scale.maximum) - axisPosition(start, scale.minimum, scale.maximum)}%` }}><b>{division.name}</b></span>;
        })}</div> : null}

        <div className="wr-cloud-players">{layout.map((player) => {
          const profile = profiles[player.id];
          const isSelected = player.id === selectedPlayer.id;
          const showTooltip = player.id === tooltipId;
          const percentile = profile?.percentile ?? ((totalPlayers - player.ranking) / Math.max(1, totalPlayers)) * 100;
          return <a
            aria-label={`Open ${player.name} Lounge profile`}
            className={`wr-cloud-player${isSelected ? " selected" : ""}${showTooltip ? " tooltip-visible" : ""}`}
            data-player-id={player.id}
            href={player.url}
            key={player.id}
            onClick={() => setSelectedId(player.id)}
            onFocus={() => setHoveredId(player.id)}
            onMouseEnter={() => setHoveredId(player.id)}
            onMouseLeave={() => setHoveredId(null)}
            rel="noreferrer"
            style={{ left: `${player.x}%`, top: `${player.y}%` }}
            target="_blank"
          >
            <span className="wr-cloud-avatar" style={avatarStyle(profile)} />
            {profile?.emblem ? <span className="wr-cloud-emblem" style={{ backgroundImage: `url("${profile.emblem}")` }} /> : null}
            <span className="wr-cloud-tooltip">
              <span className="wr-cloud-avatar detail" style={avatarStyle(profile)} />
              <span><strong>{player.name}</strong><small>{player.currentDivision}</small></span>
              <dl><div><dt>LR</dt><dd>{formatNumber(player.currentLr)}</dd></div><div><dt>MMR</dt><dd>{formatNumber(player.currentMmr)}</dd></div><div><dt>Position</dt><dd>#{player.ranking} of {formatNumber(totalPlayers)}</dd></div></dl>
              <b>Top {(100 - percentile).toFixed(1)}%</b>
            </span>
          </a>;
        })}</div>

        <div className="wr-cloud-axis">{scale.ticks.map((tick, index) => <span key={tick} style={{ left: `${axisPosition(tick, scale.minimum, scale.maximum)}%` }}><i /><b>{formatNumber(tick)}{index === scale.ticks.length - 1 ? "+" : ""}</b></span>)}</div>
      </div>
    </div>

    <footer className="wr-cloud-footer">
      <div className="wr-cloud-selected">
        <span className="wr-cloud-avatar large" style={avatarStyle(profiles[selectedPlayer.id])} />
        <div><small>Selected player</small><strong>{selectedPlayer.name}</strong><span>{selectedPlayer.currentDivision} · #{selectedPlayer.ranking}</span></div>
      </div>
      <p>You are rated higher than <strong>{selectedPercentile.toFixed(1)}%</strong> of active {track.toUpperCase()} Lounge players.</p>
      <a href={selectedPlayer.url} rel="noreferrer" target="_blank">Open profile</a>
    </footer>
  </section>;
}

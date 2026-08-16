"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

export type AlmiaResultPlayer = {
  name: string;
  id: string | null;
  competed: boolean;
  mmr: number | null;
  mmrSeed: number | null;
  division: string;
  profileUrl: string | null;
  result: string;
  finalPlace: number | null;
  finalScore: number | null;
  lastScore: number | null;
  maxRound: number;
  overallPlace: number;
};

type LayoutPlayer = AlmiaResultPlayer & { lane: number; x: number; y: number };

const formatNumber = (value: number | null) => Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(value as number) : "-";
const ordinal = (value: number) => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"}`;
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function xForPlace(place: number, total: number) {
  return 5 + ((total - place) / Math.max(1, total - 1)) * 90;
}

function stageFor(player: AlmiaResultPlayer) {
  if (!player.competed) return "DNS";
  if (player.finalPlace) return "Final";
  if (player.maxRound === 3) return "Semifinal";
  return `Round ${player.maxRound}`;
}

function buildLayout(players: AlmiaResultPlayer[]) {
  const placed: LayoutPlayer[] = [];
  const total = players.length;
  for (const player of players.slice().sort((a, b) => b.overallPlace - a.overallPlace)) {
    const x = xForPlace(player.overallPlace, total);
    let lane = 0;
    while (placed.some((row) => row.lane === lane && Math.abs(row.x - x) < 2.65)) lane += 1;
    const jitter = ((stableHash(player.id || player.name) % 7) - 3) * 0.35;
    placed.push({ ...player, lane, x, y: 78 - lane * 9.2 + jitter });
  }
  return placed;
}

export default function AlmiaResultCloud({ players, winner }: { players: AlmiaResultPlayer[]; winner: string }) {
  const orderedPlayers = useMemo(() => players.slice().sort((a, b) => a.overallPlace - b.overallPlace), [players]);
  const layout = useMemo(() => buildLayout(orderedPlayers), [orderedPlayers]);
  const [selectedName, setSelectedName] = useState(winner);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const selectedPlayer = orderedPlayers.find((player) => player.name === selectedName) || orderedPlayers[0];
  const suggestions = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value || selectedPlayer?.name.toLowerCase() === value) return [];
    return orderedPlayers.filter((player) => player.name.toLowerCase().includes(value)).slice(0, 6);
  }, [orderedPlayers, query, selectedPlayer]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !selectedPlayer) return;
    const marker = viewport.querySelector<HTMLElement>(`[data-almia-player="${CSS.escape(selectedPlayer.name)}"]`);
    if (!marker) return;
    viewport.scrollTo({ behavior: "smooth", left: Math.max(0, marker.offsetLeft - viewport.clientWidth / 2) });
  }, [selectedPlayer]);

  const selectPlayer = (player: AlmiaResultPlayer) => {
    setSelectedName(player.name);
    setQuery(player.name);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim().toLowerCase();
    const player = orderedPlayers.find((row) => row.name.toLowerCase() === value) || suggestions[0];
    if (player) selectPlayer(player);
  };

  if (!selectedPlayer) return null;
  const stages = ["DNS", "Round 1", "Round 2", "Semifinal", "Final"];

  return <section className="ar-cloud-shell" aria-label="Almia Upper complete tournament result visualization">
    <header className="ar-cloud-header">
      <span className="ww-checkers" aria-hidden="true" />
      <div><small>August 15, 2026 · Complete Field</small><strong>Almia Worldwide Results</strong></div>
      <span className="ww-checkers" aria-hidden="true" />
    </header>

    <div className="ar-cloud-toolbar">
      <div><small>Placement axis</small><strong>85th to 1st</strong></div>
      <form onSubmit={submitSearch}>
        <label htmlFor="almia-result-search">Find a tournament player</label>
        <div><input autoComplete="off" id="almia-result-search" onChange={(event) => setQuery(event.target.value)} placeholder="Type a Lounge name..." type="search" value={query} /><button type="submit">Find</button></div>
        {suggestions.length ? <div className="ar-cloud-suggestions">{suggestions.map((player) => <button key={player.name} onClick={() => selectPlayer(player)} type="button"><span className="ar-cloud-mii mini" /><span><strong>{player.name}</strong><small>{ordinal(player.overallPlace)} · {stageFor(player)}</small></span></button>)}</div> : null}
      </form>
    </div>

    <div className="ar-cloud-viewport" ref={viewportRef}>
      <div className="ar-cloud-stage">
        <div className="ar-cloud-stars" />
        <div className="ar-cloud-earth" />
        <div className="ar-cloud-stage-bands">{stages.map((stage) => {
          const stagePlayers = orderedPlayers.filter((player) => stageFor(player) === stage);
          if (!stagePlayers.length) return null;
          const left = Math.min(...stagePlayers.map((player) => xForPlace(player.overallPlace, orderedPlayers.length)));
          const right = Math.max(...stagePlayers.map((player) => xForPlace(player.overallPlace, orderedPlayers.length)));
          return <span className={`stage-${stage.toLowerCase().replace(/\s/g, "-")}`} key={stage} style={{ left: `${Math.max(0, left - 0.55)}%`, width: `${Math.max(1.1, right - left + 1.1)}%` }}><b>{stage}</b></span>;
        })}</div>

        <div className="ar-cloud-players">{layout.map((player) => {
          const selected = player.name === selectedPlayer.name;
          const tooltipVisible = player.name === (hoveredName || selectedPlayer.name);
          const marker = <>
            <span className="ar-cloud-mii" />
            <span className="ar-cloud-place">{player.overallPlace}</span>
            <span className="ar-cloud-tooltip">
              <span className="ar-cloud-mii detail" />
              <span><strong>{player.name}</strong><small>{player.division}</small></span>
              <dl><div><dt>Overall</dt><dd>{ordinal(player.overallPlace)}</dd></div><div><dt>Result</dt><dd>{player.result}</dd></div><div><dt>Score</dt><dd>{formatNumber(player.finalScore ?? player.lastScore)} pts</dd></div><div><dt>MMR Seed</dt><dd>{player.mmrSeed ? `#${player.mmrSeed}` : "-"}</dd></div></dl>
            </span>
          </>;
          const className = `ar-cloud-player${selected ? " selected" : ""}${tooltipVisible ? " tooltip-visible" : ""}${player.overallPlace <= 10 ? " edge-right" : ""}${player.overallPlace >= 76 ? " edge-left" : ""}`;
          const common = {
            "aria-label": `Select ${player.name}, ${ordinal(player.overallPlace)} overall`,
            className,
            "data-almia-player": player.name,
            onClick: () => setSelectedName(player.name),
            onFocus: () => setHoveredName(player.name),
            onMouseEnter: () => setHoveredName(player.name),
            onMouseLeave: () => setHoveredName(null),
            style: { left: `${player.x}%`, top: `${player.y}%` },
          };
          return player.profileUrl ? <a {...common} href={player.profileUrl} key={player.name} rel="noreferrer" target="_blank">{marker}</a> : <button {...common} key={player.name} type="button">{marker}</button>;
        })}</div>

        <div className="ar-cloud-axis">{[85, 75, 50, 25, 12, 1].map((place) => <span key={place} style={{ left: `${xForPlace(place, orderedPlayers.length)}%` }}><i /><b>{ordinal(place)}</b></span>)}</div>
      </div>
    </div>

    <footer className="ar-cloud-footer">
      <div className="ar-cloud-selected"><span className="ar-cloud-mii large" /><div><small>Selected result</small><strong>{selectedPlayer.name}</strong><span>{ordinal(selectedPlayer.overallPlace)} overall · {selectedPlayer.result}</span></div></div>
      <p>Finalists use official placement. Eliminated players are ordered by score in their last round.</p>
      {selectedPlayer.profileUrl ? <a href={selectedPlayer.profileUrl} rel="noreferrer" target="_blank">Open profile</a> : <span />}
    </footer>
  </section>;
}

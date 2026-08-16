"use client";

import { useMemo, useState } from "react";
import AlmiaResultCloud from "./AlmiaResultCloud";

type Player = {
  name: string; id: string | null; competed: boolean; mmr: number | null; lr: number | null; rank: number | null;
  division: string; peakMmr: number | null; profileUrl: string | null; result: string; finalPlace: number | null;
  finalScore: number | null; allTimeGrandmaster: boolean; mmrSeed: number | null; expectedResult: string;
  stageDelta: number; firstHit?: string; maxRound: number; lastScore: number | null; lastRoomPlace: number | null;
  overallPlace: number;
};
type Room = { id: string; roundLabel: string; room: number; host: string; format: string; averageMmr: number | null; averageRank: number | null; difficultyRank: number };
export type AlmiaUpperData = {
  meta: { ladderId: number; ratingCutoff: string; methodology: string; unmatched: string[] };
  summary: { registeredPlayers: number; competitors: number; rooms: number; rounds: number; winner: string; winnerScore: number; fieldAverageMmr: number; matchedPlayers: number; allTimeGrandmasters: number };
  topRankCounts: Array<{ threshold: number; value: number }>;
  roomDifficulty: Room[];
  rankDistribution: Array<{ division: string; value: number }>;
  roundStrength: Array<{ round: number; label: string; playerCount: number; averageMmr: number; averageLr: number }>;
  outperformers: Player[]; grandmasters: Player[]; finalPlayers: Player[]; players: Player[];
};

const fmt = (value: number | null | undefined) => Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(value as number) : "-";
const cutoff = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago", timeZoneName: "short" }).format(new Date(value));

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="almia-stat"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function DifficultyBoard({ rooms }: { rooms: Room[] }) {
  const max = Math.max(...rooms.map((room) => room.averageMmr || 0), 1);
  return <div className="difficulty-board">{rooms.map((room) => <article className="difficulty-row" key={room.id}>
    <b>{room.difficultyRank}</b><div><div className="difficulty-label"><strong>{room.roundLabel} · Room {room.room}</strong><span>{fmt(room.averageMmr)} avg MMR</span></div>
    <div className="difficulty-track"><i style={{ width: `${((room.averageMmr || 0) / max) * 100}%` }} /></div>
    <small>Host {room.host} · avg ladder rank {fmt(room.averageRank)} · {room.format}</small></div>
  </article>)}</div>;
}

function DivisionCurve({ rows }: { rows: AlmiaUpperData["rankDistribution"] }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <div className="division-curve" aria-label="Tournament LR rank distribution">{rows.map((row) => <div className="division-column" key={row.division}>
    <b>{row.value}</b><div><i style={{ height: `${Math.max(3, (row.value / max) * 100)}%` }} /></div><span>{row.division}</span>
  </div>)}</div>;
}

export default function AlmiaUpperDashboard({ data }: { data: AlmiaUpperData | null }) {
  const [query, setQuery] = useState("");
  const visiblePlayers = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? data?.players.filter((player) => player.name.toLowerCase().includes(value)) || [] : data?.players || [];
  }, [data, query]);
  if (!data) return <section className="panel wide almia-empty">Tournament analysis is loading.</section>;
  const maxRoundMmr = Math.max(...data.roundStrength.map((round) => round.averageMmr || 0), 1);
  const champion = data.players.find((player) => player.name === data.summary.winner);

  return <section className="almia-dashboard" aria-label="Almia Upper tournament analysis">
    <header className="panel wide almia-head"><div><p className="eyebrow">RT Upper · August 15, 2026</p><h2>Almia Upper Result</h2><p>Four rounds measured against the RT ladder exactly four hours before the source refresh.</p></div>
      <div className="almia-champion"><span>Champion</span><div className="almia-champion-player"><span className="almia-champion-mii" /><div><strong>{data.summary.winner}</strong><b>{data.summary.winnerScore} final points</b>{champion?.profileUrl ? <a href={champion.profileUrl} rel="noreferrer" target="_blank">Open profile</a> : null}</div></div></div></header>

    <AlmiaResultCloud players={data.players} winner={data.summary.winner} />

    <div className="almia-stats">
      <Stat label="Competed" value={fmt(data.summary.competitors)} detail={`${data.summary.registeredPlayers} registered · 1 DNS`} />
      <Stat label="Field Avg MMR" value={fmt(data.summary.fieldAverageMmr)} detail={`RT S${data.meta.ladderId} cutoff`} />
      <Stat label="Rooms" value={fmt(data.summary.rooms)} detail={`${data.summary.rounds} tournament rounds`} />
      <Stat label="All-Time GMs" value={fmt(data.summary.allTimeGrandmasters)} detail="among players who started" />
      <Stat label="Rating Coverage" value={`${data.summary.matchedPlayers}/${data.summary.competitors}`} detail="competitors matched" />
    </div>

    <section className="panel wide cutoff-strip"><span>Rating cutoff</span><strong>{cutoff(data.meta.ratingCutoff)}</strong><small>{data.meta.methodology}</small></section>

    <section className="panel wide"><div className="panel-head"><div><p className="eyebrow">Field Quality</p><h2>Top-ranked players in the field</h2></div><span>RT position at cutoff</span></div>
      <div className="top-rank-grid">{data.topRankCounts.map((row) => <article key={row.threshold}><span>Top {row.threshold}</span><strong>{row.value}</strong><small>players competed</small></article>)}</div></section>

    <section className="panel wide"><div className="panel-head"><div><p className="eyebrow">Hardest to Easiest</p><h2>Every room ranked by average MMR</h2></div><span>{data.roomDifficulty.length} rooms</span></div><DifficultyBoard rooms={data.roomDifficulty} /></section>

    <div className="almia-two-column"><section className="panel"><div className="panel-head compact"><div><p className="eyebrow">LR Distribution</p><h2>Rank bell curve</h2></div></div><DivisionCurve rows={data.rankDistribution} /></section>
      <section className="panel"><div className="panel-head compact"><div><p className="eyebrow">Round Strength</p><h2>Average rating by round</h2></div></div><div className="round-strength">{data.roundStrength.map((round) => <article key={round.round}>
        <div><strong>{round.label}</strong><span>{round.playerCount} players</span></div><div className="round-track"><i style={{ width: `${(round.averageMmr / maxRoundMmr) * 100}%` }} /></div><b>{fmt(round.averageMmr)} MMR</b><small>{fmt(round.averageLr)} average LR</small>
      </article>)}</div></section></div>

    <section className="panel wide"><div className="panel-head"><div><p className="eyebrow">Beat the Seed</p><h2>Players who advanced beyond MMR expectation</h2></div><span>Expected stage uses cutoff MMR seed</span></div>
      <div className="table-wrap almia-table"><table><thead><tr><th>#</th><th>Player</th><th>MMR Seed</th><th>MMR</th><th>Expected</th><th>Result</th><th>Rounds Beat</th></tr></thead><tbody>{data.outperformers.map((player, index) => <tr key={player.name}><td>{index + 1}</td><td>{player.name}</td><td>#{player.mmrSeed}</td><td>{fmt(player.mmr)}</td><td>{player.expectedResult}</td><td className="positive">{player.result}</td><td className="positive">+{player.stageDelta}</td></tr>)}</tbody></table></div></section>

    <div className="almia-two-column"><section className="panel"><div className="panel-head compact"><div><p className="eyebrow">Final Standings</p><h2>Top 12</h2></div></div><div className="final-standings">{data.finalPlayers.map((player) => <article key={player.name}><b>{player.finalPlace}</b><strong>{player.name}</strong><span>{player.finalScore} pts</span></article>)}</div></section>
      <section className="panel"><div className="panel-head compact"><div><p className="eyebrow">All-Time Status</p><h2>Grandmasters in the field</h2></div><span>{data.grandmasters.length}</span></div><div className="gm-field-list">{data.grandmasters.map((player, index) => <article key={player.id || player.name}><b>{index + 1}</b><div><strong>{player.name}</strong><small>First seen {player.firstHit || "in export"}</small></div><span>{fmt(player.peakMmr)} peak</span></article>)}</div></section></div>

    <section className="panel wide"><div className="panel-head"><div><p className="eyebrow">Complete Field</p><h2>All registered players by cutoff MMR</h2></div><span>{visiblePlayers.length} shown</span></div>
      <div className="leaderboard-tools"><input aria-label="Search tournament players" onChange={(event) => setQuery(event.target.value)} placeholder="Search tournament player..." type="search" value={query} /></div>
      <div className="table-wrap almia-player-table"><table><thead><tr><th>Seed</th><th>Player</th><th>Ladder Rank</th><th>MMR</th><th>LR</th><th>Division</th><th>Expected</th><th>Result</th><th>GM</th><th>Profile</th></tr></thead><tbody>{visiblePlayers.map((player) => <tr key={player.name}>
        <td>{player.mmrSeed ? `#${player.mmrSeed}` : "-"}</td><td>{player.name}{!player.competed ? <small>Registered · DNS</small> : null}</td><td>{player.rank ? `#${player.rank}` : "-"}</td><td className="positive">{fmt(player.mmr)}</td><td>{fmt(player.lr)}</td><td>{player.division}</td><td>{player.expectedResult}</td><td>{player.result}</td><td>{player.allTimeGrandmaster ? "Yes" : "-"}</td><td>{player.profileUrl ? <a className="result-link" href={player.profileUrl} rel="noreferrer" target="_blank">Open</a> : "-"}</td>
      </tr>)}</tbody></table></div></section>
  </section>;
}

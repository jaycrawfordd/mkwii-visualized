"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { type SeasonalData } from "./SeasonalDashboard";

type TrackType = "rt" | "ct";
type Season = SeasonalData["seasons"][number];
type Player = Season["leaderboard"][number];

type VectorLike = { set: (x: number, y: number, z: number) => void };
type RotationLike = { x: number; y: number; z: number };
type CameraLike = { aspect: number; position: VectorLike; updateProjectionMatrix: () => void };
type MeshLike = { position: VectorLike; rotation: RotationLike; scale: VectorLike };
type LightLike = { position: VectorLike };
type SceneLike = { add: (...objects: unknown[]) => void };
type RendererLike = {
  dispose: () => void;
  render: (scene: SceneLike, camera: CameraLike) => void;
  setPixelRatio: (ratio: number) => void;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
};
type ThreeModule = {
  Scene: new () => SceneLike;
  PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => CameraLike;
  WebGLRenderer: new (options: { alpha: boolean; antialias: boolean; canvas: HTMLCanvasElement }) => RendererLike;
  TextureLoader: new () => { load: (url: string) => unknown };
  SphereGeometry: new (radius: number, widthSegments: number, heightSegments: number) => unknown;
  MeshPhongMaterial: new (options: Record<string, unknown>) => unknown;
  MeshBasicMaterial: new (options: Record<string, unknown>) => unknown;
  Mesh: new (geometry: unknown, material: unknown) => MeshLike;
  AmbientLight: new (color: number, intensity: number) => unknown;
  DirectionalLight: new (color: number, intensity: number) => LightLike;
};

const THREE_MODULE_URL = "https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js";
const markerPositions = [
  [50, 12], [70, 28], [75, 53], [63, 73], [38, 75], [24, 55], [29, 29], [50, 43],
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function seasonDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function ThreeGlobe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendererState, setRendererState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let cleanup = () => undefined;
    const moduleUrl: string = THREE_MODULE_URL;

    void import(/* @vite-ignore */ moduleUrl).then((module) => {
      if (cancelled) return;
      const THREE = module as unknown as ThreeModule;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas });
      const texture = new THREE.TextureLoader().load("/map.jpg");
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(1, 72, 48),
        new THREE.MeshPhongMaterial({ map: texture, shininess: 18, specular: 0x9bdcff }),
      );
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.035, 72, 48),
        new THREE.MeshBasicMaterial({ color: 0x39c7ff, opacity: 0.13, side: 1, transparent: true }),
      );
      const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
      const rimLight = new THREE.DirectionalLight(0x19bfff, 2.1);
      const ambientLight = new THREE.AmbientLight(0x9ecff2, 1.25);
      keyLight.position.set(-2.5, 2.3, 3.5);
      rimLight.position.set(3, -1, -2);
      camera.position.set(0, 0, 3.25);
      globe.rotation.x = -0.08;
      scene.add(globe, atmosphere, keyLight, rimLight, ambientLight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      let frame = 0;
      let dragging = false;
      let pointerX = 0;
      let velocity = 0.0018;

      const resize = () => {
        const bounds = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(bounds.width));
        const height = Math.max(1, Math.round(bounds.height));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const render = () => {
        velocity *= dragging ? 0.9 : 0.985;
        globe.rotation.y += 0.0017 + velocity;
        atmosphere.rotation.y = globe.rotation.y;
        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(render);
      };
      const pointerDown = (event: PointerEvent) => {
        dragging = true;
        pointerX = event.clientX;
        canvas.setPointerCapture(event.pointerId);
      };
      const pointerMove = (event: PointerEvent) => {
        if (!dragging) return;
        const delta = event.clientX - pointerX;
        pointerX = event.clientX;
        velocity = delta * 0.00012;
        globe.rotation.y += delta * 0.006;
      };
      const pointerUp = (event: PointerEvent) => {
        dragging = false;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      canvas.addEventListener("pointerdown", pointerDown);
      canvas.addEventListener("pointermove", pointerMove);
      canvas.addEventListener("pointerup", pointerUp);
      canvas.addEventListener("pointercancel", pointerUp);
      resize();
      render();
      setRendererState("ready");

      cleanup = () => {
        window.cancelAnimationFrame(frame);
        observer.disconnect();
        canvas.removeEventListener("pointerdown", pointerDown);
        canvas.removeEventListener("pointermove", pointerMove);
        canvas.removeEventListener("pointerup", pointerUp);
        canvas.removeEventListener("pointercancel", pointerUp);
        renderer.dispose();
      };
    }).catch(() => {
      if (!cancelled) setRendererState("fallback");
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return <div className={`ww-globe-renderer ${rendererState}`} data-renderer={rendererState}>
    <div className="ww-globe-fallback" />
    <canvas aria-label="Interactive rotating worldwide globe" ref={canvasRef} />
  </div>;
}

function PlayerBubble({ player, position, selected, onSelect }: { player: Player; position: readonly [number, number]; selected: boolean; onSelect: () => void }) {
  const style = { left: `${position[0]}%`, top: `${position[1]}%` } as CSSProperties;
  return <button aria-label={`Select rank ${player.rank}, ${player.name}`} className={`ww-player-bubble${selected ? " selected" : ""}`} onClick={onSelect} style={style} type="button">
    <span className="ww-mii-face" />
    <span className="ww-bubble-label"><b>#{player.rank} {player.name}</b><small>{formatNumber(player.mmr)} MMR</small></span>
  </button>;
}

export default function WorldwideDashboard({ data, track }: { data: SeasonalData | null; track: TrackType }) {
  const seasons = useMemo(() => data?.seasons.filter((season) => season.meta.track === track).sort((a, b) => b.meta.ladderId - a.meta.ladderId) || [], [data, track]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const defaultSeasonId = seasons.find((season) => season.meta.current)?.meta.ladderId ?? seasons[0]?.meta.ladderId ?? null;
  const effectiveSeasonId = seasons.some((season) => season.meta.ladderId === selectedSeasonId) ? selectedSeasonId : defaultSeasonId;
  const seasonIndex = seasons.findIndex((season) => season.meta.ladderId === effectiveSeasonId);
  const season = seasons[seasonIndex] || seasons[0];
  const player = season?.leaderboard.find((row) => row.id === selectedPlayerId) || season?.leaderboard[0];

  if (!data || !season || !player) {
    return <section className="ww-shell ww-loading" aria-label="Worldwide leaderboard loading"><strong>Searching for players...</strong></section>;
  }

  const changeSeason = (nextIndex: number) => {
    const next = seasons[nextIndex];
    if (!next) return;
    setSelectedSeasonId(next.meta.ladderId);
    setSelectedPlayerId(null);
  };

  return <section className="ww-shell" aria-label={`${season.meta.label} worldwide leaderboard test`}>
    <header className="ww-header">
      <div><span className="ww-signal"><i /><i /><i /></span><strong>Worldwide VS Race</strong></div>
      <p>{track.toUpperCase()} Lounge Rankings</p>
      <span>{season.meta.current ? "Online" : "Archive"}</span>
    </header>

    <div className="ww-season-nav">
      <button aria-label="Newer season" disabled={seasonIndex <= 0} onClick={() => changeSeason(seasonIndex - 1)} title="Newer season" type="button">&larr;</button>
      <div><span>{track.toUpperCase()} Season</span><strong>{season.meta.ladderId}</strong><small>{seasonDate(season.meta.start)} - {seasonDate(season.meta.end)}</small></div>
      <button aria-label="Older season" disabled={seasonIndex >= seasons.length - 1} onClick={() => changeSeason(seasonIndex + 1)} title="Older season" type="button">&rarr;</button>
    </div>

    <div className="ww-world-grid">
      <div className="ww-globe-stage">
        <div className="ww-stars" />
        <ThreeGlobe />
        <div className="ww-player-markers">{season.leaderboard.slice(0, markerPositions.length).map((row, index) => <PlayerBubble key={row.id} onSelect={() => setSelectedPlayerId(row.id)} player={row} position={markerPositions[index]} selected={row.id === player.id} />)}</div>
        <div className="ww-selected-player">
          <span className="ww-mii-face large" />
          <div><small>Selected racer</small><strong>{player.name}</strong><span>{player.division}</span></div>
          <dl><div><dt>MMR</dt><dd>{formatNumber(player.mmr)}</dd></div><div><dt>LR</dt><dd>{formatNumber(player.lr)}</dd></div><div><dt>Peak</dt><dd>{formatNumber(player.peakMmr)}</dd></div></dl>
        </div>
      </div>

      <aside className="ww-ranking">
        <div className="ww-ranking-head"><span>Season Standings</span><strong>{formatNumber(season.meta.playerCount)}</strong></div>
        <div className="ww-ranking-list">{season.leaderboard.map((row) => <button className={row.id === player.id ? "selected" : ""} key={row.id} onClick={() => setSelectedPlayerId(row.id)} type="button">
          <b>{row.rank}</b><span className="ww-mii-face small" /><span><strong>{row.name}</strong><small>{row.division} · {row.events} events</small></span><em>{formatNumber(row.mmr)}</em>
        </button>)}</div>
      </aside>
    </div>

    <footer className="ww-footer">
      <a href={season.meta.sourceUrl} rel="noreferrer" target="_blank"><span aria-hidden="true">+</span> Source leaderboard</a>
      <p><b>{season.summary.champion?.name}</b> finished #1 with {formatNumber(season.summary.champion?.mmr || 0)} MMR</p>
      <span className="ww-checkers" aria-hidden="true" />
    </footer>
  </section>;
}

import { useEffect, useRef, useState } from 'react';
import { ControlDock } from './components/ControlDock';
import { EngineerNotebook } from './components/EngineerNotebook';
import { EnesCoreEngine } from './game/engine';
import { GameSnapshot, ZONES, ZoneId } from './game/types';

const INITIAL_SNAPSHOT: GameSnapshot = {
  started: false,
  cameraMode: 'first',
  currentZone: 'turbine',
  health: 100,
  maxHealth: 100,
  voltage: 1,
  isRepairing: false,
  activeRepairLabel: null,
  activeRepairProgress: 0,
  nearbyPrompt: null,
  heldObjectName: null,
  grappleReady: false,
  notebookOpen: false,
  muted: false,
  pointerLocked: false,
  repairs: [],
  enemiesDefeated: 0,
  totalEnemies: 0,
  bossHealth: 420,
  bossMaxHealth: 420,
  bossActive: false,
  bossDefeated: false,
  victory: false,
  playerDefeated: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EnesCoreEngine | null>(null);

  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_SNAPSHOT);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new EnesCoreEngine(
      container,
      (snap) => setSnapshot(snap),
      () => setContextLost(true),
    );
    engineRef.current = engine;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const currentZoneInfo = ZONES.find((z) => z.id === snapshot.currentZone) ?? ZONES[0];

  const handleWarpZone = (zoneId: ZoneId) => {
    engineRef.current?.warpToZone(zoneId);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b0d10]">
      {/* Isolated 3D WebGL Viewport */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {/* Graceful WebGL fallback if GPU context is lost */}
      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0d10] p-6">
          <div className="max-w-md rounded-xl border border-white/15 bg-[#12161c] p-6 text-center">
            <h2 className="font-display text-xl font-bold text-stone-100">
              Grafik Bağlamı Kesildi
            </h2>
            <p className="mt-2 text-sm text-stone-400">
              WebGL görüntüleme bağlamı tarayıcı tarafından duraklatıldı. Sahneyi yeniden başlatmak için sayfayı yenileyin.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-500 transition-colors cursor-pointer"
            >
              Yeniden Yükle
            </button>
          </div>
        </div>
      )}

      {/* Minimal Top-Left Zone Whisper (Diegetic Zero-UI — no stat bars or badges) */}
      {snapshot.started && !snapshot.notebookOpen && (
        <div className="fixed top-4 left-5 z-10 pointer-events-none">
          <p className="font-display text-sm font-semibold tracking-wide text-stone-200">
            {currentZoneInfo.index}. {currentZoneInfo.titleTr}
          </p>
          <p className="text-xs text-stone-400">
            {currentZoneInfo.titleEn} · Baş Mühendis Enes Öztürk
          </p>
        </div>
      )}

      {/* Subtle Diegetic Crosshair & Contextual 3D Interaction Whisper */}
      {snapshot.started && !snapshot.notebookOpen && !snapshot.victory && !snapshot.playerDefeated && (
        <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div className="relative flex flex-col items-center">
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                snapshot.grappleReady
                  ? 'bg-amber-400 scale-150'
                  : snapshot.heldObjectName
                  ? 'bg-sky-400 scale-125'
                  : 'bg-white/65'
              }`}
            />

            {snapshot.grappleReady && (
              <span className="mt-3 text-xs font-medium text-amber-300">
                [Q] Manyetik Kanca
              </span>
            )}

            {snapshot.heldObjectName && (
              <span className="mt-3 text-xs font-medium text-sky-300">
                Tutuluyor: {snapshot.heldObjectName} — [Sağ Tık / F] Fırlat
              </span>
            )}

            {snapshot.nearbyPrompt && (
              <div className="mt-6 rounded-lg border border-white/12 bg-[#111419]/92 px-3.5 py-1.5 text-xs font-medium text-stone-100">
                {snapshot.nearbyPrompt}
                {snapshot.isRepairing && (
                  <div className="mt-1.5 h-1 w-44 overflow-hidden rounded-full bg-stone-800">
                    <div
                      className="h-full bg-amber-500 transition-transform"
                      style={{ width: `${Math.round(snapshot.activeRepairProgress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Opening Briefing Screen over Live 3D Turbine Hall */}
      {!snapshot.started && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 p-6">
          <div className="w-full max-w-2xl rounded-xl border border-white/12 bg-[#101318]/94 p-7 md:p-9 shadow-2xl">
            <p className="text-xs text-stone-400">
              Enes Öztürk Özel Yapımı · 5 Kesintisiz Katman · Sıfır Yapay Gösterge
            </p>
            <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold tracking-tight text-stone-100 text-balance">
              Iron &amp; Silicon: The Sovereign Engineer
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-stone-300 max-w-xl">
              Çökmekte olan dev yeraltı süper-bilgisayar ve enerji kompleksini kurtarmak için sahaya inen Baş Mühendis Enes Öztürk olarak; sağ elindeki yüksek gerilimli <strong className="text-stone-100 font-medium">Volt-Maul</strong> çekici ve sol elindeki elektromanyetik <strong className="text-stone-100 font-medium">Flux Eldiveni</strong> ile savunma otomatlarını parçala, arızalı vanaları elinle onar.
            </p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 border-y border-white/10 py-4 text-xs text-stone-300">
              <div>
                <span className="font-mono-tech text-amber-400">WASD / Boşluk</span>
                <p className="text-stone-400 mt-0.5">Hareket ve Zıplama</p>
              </div>
              <div>
                <span className="font-mono-tech text-amber-400">Sol Tık / J</span>
                <p className="text-stone-400 mt-0.5">Volt-Maul Çekiç Darbesi</p>
              </div>
              <div>
                <span className="font-mono-tech text-amber-400">Sağ Tık / F</span>
                <p className="text-stone-400 mt-0.5">Manyetik Çekme ve Fırlatma</p>
              </div>
              <div>
                <span className="font-mono-tech text-amber-400">Q Tuşu</span>
                <p className="text-stone-400 mt-0.5">Üst Borulara Kanca At</p>
              </div>
              <div>
                <span className="font-mono-tech text-amber-400">E (Basılı Tut)</span>
                <p className="text-stone-400 mt-0.5">Gerçek Zamanlı Onarım / Pres</p>
              </div>
              <div>
                <span className="font-mono-tech text-amber-400">V / Tab / H</span>
                <p className="text-stone-400 mt-0.5">1./3. Şahıs · Defter · Gizle</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-stone-400">
                Sağlık bilekteki pirinç manometreden, voltaj ise çekicin bakır bobinlerinden okunur.
              </p>
              <button
                type="button"
                onClick={() => engineRef.current?.startGame()}
                className="rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sahaya İn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Defeat End Overlay */}
      {(snapshot.victory || snapshot.playerDefeated) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-6">
          <div className="w-full max-w-lg rounded-xl border border-white/15 bg-[#101318]/96 p-7 text-center shadow-2xl">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-stone-100">
              {snapshot.victory
                ? 'Çekirdek Komuta Merkezi Kurtarıldı'
                : 'Buhar-Plazma Basıncı Tükenmek Üzere'}
            </h2>
            <p className="mt-3 text-sm text-stone-300">
              {snapshot.victory
                ? 'Merkezi Savunma Otomatı parçalandı ve yeraltı enerji kompleksi yeniden dengelendi.'
                : 'Sırt jeneratörü basıncı kritik eşiğin altına düştü. Teçhizatı sıfırlayıp tekrar dene.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3 text-xs text-stone-400">
              <span>Parçalanan Otomat: {snapshot.enemiesDefeated}/{snapshot.totalEnemies}</span>
              <span aria-hidden="true">·</span>
              <span>
                Onarılan Sistem: {snapshot.repairs.filter((r) => r.repaired).length}/
                {snapshot.repairs.filter((r) => r.kind !== 'press').length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => engineRef.current?.restartMission()}
              className="mt-6 rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 transition-colors cursor-pointer"
            >
              Tekrar Oyna
            </button>
          </div>
        </div>
      )}

      {/* Enes Ozturk's Graph-Paper Engineer's Notebook */}
      <EngineerNotebook
        snapshot={snapshot}
        onClose={() => engineRef.current?.toggleNotebook()}
        onWarpZone={handleWarpZone}
      />

      {/* Collapsible Bottom Control Dock (Press H to hide for pure Zero-UI) */}
      <ControlDock
        snapshot={snapshot}
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
        onToggleCamera={() => engineRef.current?.toggleCameraMode()}
        onToggleNotebook={() => engineRef.current?.toggleNotebook()}
        onToggleMute={() => engineRef.current?.toggleMute()}
        onWarpZone={handleWarpZone}
      />
    </div>
  );
}

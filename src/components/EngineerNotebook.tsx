import React from 'react';
import { X } from 'lucide-react';
import { GameSnapshot, ZONES, ZoneId } from '../game/types';

interface EngineerNotebookProps {
  snapshot: GameSnapshot;
  onClose: () => void;
  onWarpZone: (zoneId: ZoneId) => void;
}

export const EngineerNotebook: React.FC<EngineerNotebookProps> = ({
  snapshot,
  onClose,
  onWarpZone,
}) => {
  if (!snapshot.notebookOpen) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Enes Öztürk Mühendis Defteri"
    >
      <div className="graph-paper-bg relative w-full max-w-4xl rounded-xl border border-[#8e8268] text-[#1f242c] shadow-2xl overflow-hidden">
        {/* Leather notebook spine accent */}
        <div className="flex items-center justify-between border-b border-[#8e8268]/40 bg-[#e7dfc8] px-6 py-4">
          <div>
            <p className="font-hand text-2xl font-bold leading-none text-[#2c251d]">
              Enes Öztürk — Saha Mühendislik Defteri
            </p>
            <p className="mt-1 text-xs text-[#595043]">
              El Çizimi Kompleks Krokisi · 5 Kesintisiz Endüstriyel Katman
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-[#8e8268]/50 bg-[#f6f1e4] px-3 py-1.5 text-xs font-medium text-[#2c251d] hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            <span>Defteri Kapat (Tab)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 max-h-[78vh] overflow-y-auto">
          {/* Left Page: Hand-sketched SVG Cross-Section Schematic */}
          <div className="md:col-span-5 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#8e8268]/35 pb-5 md:pb-0 md:pr-6">
            <div>
              <h2 className="font-hand text-xl font-bold text-[#2f3a48]">
                Yeraltı Kompleksi Krokisi
              </h2>
              <p className="text-xs text-[#5d5548] mb-3">
                Bölgeye gitmek için krokideki katmana tıklayın.
              </p>

              {/* Hand-drawn pencil schematic */}
              <svg
                viewBox="0 0 260 360"
                className="w-full h-auto border border-[#486c8a]/30 bg-[#f7f3e7]/80 rounded-lg p-2"
                aria-label="5 Katmanlı Kompleks Krokisi"
              >
                {/* Connecting shaft line */}
                <line
                  x1="130"
                  y1="26"
                  x2="130"
                  y2="334"
                  stroke="#3d4c5c"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />

                {ZONES.map((z, idx) => {
                  const y = 20 + idx * 66;
                  const isCurrent = snapshot.currentZone === z.id;
                  const zoneRepairs = snapshot.repairs.filter((r) => r.zoneId === z.id && r.kind !== 'press');
                  const doneCount = zoneRepairs.filter((r) => r.repaired).length;
                  const allDone = zoneRepairs.length > 0 && doneCount === zoneRepairs.length;

                  return (
                    <g
                      key={z.id}
                      onClick={() => onWarpZone(z.id)}
                      className="cursor-pointer"
                    >
                      <rect
                        x="22"
                        y={y}
                        width="216"
                        height="52"
                        rx="4"
                        fill={isCurrent ? '#dce8f2' : '#f3eedf'}
                        stroke={isCurrent ? '#1d4ed8' : allDone ? '#15803d' : '#4a4337'}
                        strokeWidth={isCurrent ? '2.2' : '1.4'}
                      />
                      <text
                        x="34"
                        y={y + 21}
                        fill="#1e242c"
                        fontSize="11.5"
                        fontWeight="700"
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        {z.index}. {z.titleEn}
                      </text>
                      <text
                        x="34"
                        y={y + 39}
                        fill="#4f5866"
                        fontSize="10"
                        fontFamily="IBM Plex Mono, monospace"
                      >
                        {z.id === 'core'
                          ? snapshot.bossDefeated
                            ? 'Çekirdek Temizlendi'
                            : `Ana Otomat: ${snapshot.bossHealth}/${snapshot.bossMaxHealth}`
                          : z.id === 'foundry'
                          ? '2 Hidrolik Pres Aktif'
                          : `Onarım: ${doneCount}/${zoneRepairs.length}`}
                      </text>
                      {isCurrent && (
                        <circle cx="222" cy={y + 26} r="5" fill="#b93829" />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="mt-4 pt-3 border-t border-[#8e8268]/30 font-hand text-lg text-[#362f26]">
              “Bakır bobin parlıyorsa Volt-Maul hazırdır; bilekteki manometre düşerse nefesini topla.”
            </div>
          </div>

          {/* Right Page: Handwritten Field Notes & Checklist */}
          <div className="md:col-span-7 flex flex-col gap-4">
            <div>
              <h2 className="font-hand text-2xl font-bold text-[#2b241c]">
                Bölge Notları ve Donanım Onarım Listesi
              </h2>
              <p className="text-xs text-[#5d5548]">
                Otomatlar parçalandı: {snapshot.enemiesDefeated} / {snapshot.totalEnemies}
              </p>
            </div>

            <div className="space-y-3">
              {ZONES.map((z) => {
                const isCurrent = snapshot.currentZone === z.id;
                const zoneRepairs = snapshot.repairs.filter((r) => r.zoneId === z.id);
                return (
                  <div
                    key={z.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      isCurrent
                        ? 'border-[#2b547e] bg-[#e5edf5]/80'
                        : 'border-[#8e8268]/35 bg-[#faf7ee]/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onWarpZone(z.id)}
                        className="text-left font-display text-sm font-bold text-[#1f242c] hover:underline cursor-pointer"
                      >
                        {z.index}. {z.titleTr}
                      </button>
                      <button
                        type="button"
                        onClick={() => onWarpZone(z.id)}
                        className="rounded border border-[#8e8268]/50 bg-[#efe9d8] px-2.5 py-1 text-xs font-medium text-[#2c251d] hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Bölgeye Git
                      </button>
                    </div>

                    <p className="mt-1 font-hand text-lg leading-snug text-[#39414a]">
                      {z.notebookNote}
                    </p>

                    {zoneRepairs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {zoneRepairs.map((r) => (
                          <span
                            key={r.id}
                            className={
                              r.repaired
                                ? 'text-[#166534] line-through'
                                : 'text-[#4c4337]'
                            }
                          >
                            {r.repaired ? '✓ ' : '□ '}
                            {r.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

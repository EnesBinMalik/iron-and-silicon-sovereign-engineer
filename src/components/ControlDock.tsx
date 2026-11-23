import React from 'react';
import { BookOpen, Camera, ChevronDown, ChevronUp, Volume2, VolumeX } from 'lucide-react';
import { GameSnapshot, ZONES, ZoneId } from '../game/types';

interface ControlDockProps {
  snapshot: GameSnapshot;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleCamera: () => void;
  onToggleNotebook: () => void;
  onToggleMute: () => void;
  onWarpZone: (zoneId: ZoneId) => void;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  snapshot,
  collapsed,
  onToggleCollapse,
  onToggleCamera,
  onToggleNotebook,
  onToggleMute,
  onWarpZone,
}) => {
  if (!snapshot.started) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none max-w-[95vw]">
      {/* Collapse / Expand toggle tab */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="pointer-events-auto mb-1.5 flex items-center gap-1.5 rounded-md border border-white/15 bg-[#111419]/92 px-3 py-1 text-xs font-medium text-stone-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Kontrol Çubuğunu Gizle / Göster (H)"
      >
        {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <span>{collapsed ? 'Kontroller (H)' : 'Gizle (H)'}</span>
      </button>

      {!collapsed && (
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/12 bg-[#111419]/94 px-3 py-2 shadow-xl">
          {/* Camera mode */}
          <button
            type="button"
            onClick={onToggleCamera}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1f27] px-3 py-1.5 text-xs font-medium text-stone-100 hover:bg-[#242b36] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5 text-amber-400" />
            <span>{snapshot.cameraMode === 'first' ? '1. Şahıs (V)' : '3. Şahıs (V)'}</span>
          </button>

          {/* Engineer's Notebook */}
          <button
            type="button"
            onClick={onToggleNotebook}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1f27] px-3 py-1.5 text-xs font-medium text-stone-100 hover:bg-[#242b36] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5 text-sky-400" />
            <span>Mühendis Defteri (Tab)</span>
          </button>

          {/* 5 Seamless Zone Quick-Jump Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-[#0b0d10] p-1 border border-white/8">
            {ZONES.map((z) => {
              const active = snapshot.currentZone === z.id;
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => onWarpZone(z.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-amber-600 text-white'
                      : 'text-stone-400 hover:text-stone-100 hover:bg-white/5'
                  }`}
                  title={z.titleTr}
                >
                  {z.index}
                </button>
              );
            })}
          </div>

          {/* Audio Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1f27] px-3 py-1.5 text-xs font-medium text-stone-100 hover:bg-[#242b36] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {snapshot.muted ? (
              <VolumeX className="h-3.5 w-3.5 text-stone-400" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-amber-400" />
            )}
            <span>{snapshot.muted ? 'Sessiz' : 'Ses Açık'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

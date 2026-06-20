import { IconArrowDown, IconArrowUp, IconMinus, IconX } from "@tabler/icons-react";

import { useCrowdStore } from "@/stores/crowd-store";
import { CROWD_LEVEL_COLOR, type CrowdTrend } from "@/features/crowd/types";
import { cn } from "@/lib/utils";

interface CrowdRadarPanelProps {
  open: boolean;
  onClose: () => void;
}

const TREND_ICON: Record<CrowdTrend, typeof IconArrowUp> = {
  worsening: IconArrowUp,
  improving: IconArrowDown,
  steady: IconMinus,
};

const ZONE_LABEL: Record<string, string> = {
  airport: "Airport",
  hotel: "Hotel",
  beach: "Beach",
};

export function CrowdRadarPanel({ open, onClose }: CrowdRadarPanelProps) {
  const byZone = useCrowdStore((s) => s.byZone);

  const ranked = Object.values(byZone).sort((a, b) => {
    const loadA = a.load ?? -1;
    const loadB = b.load ?? -1;
    return loadA - loadB;
  });

  return (
    <div
      data-testid="crowd-radar-panel"
      data-open={open}
      className={cn(
        "fixed top-3 left-3 z-50 w-[320px] rounded-2xl bg-background/95 p-4 shadow-lg transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-[calc(100%_+_12px)]"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">Crowd Radar</h2>
        <button
          onClick={onClose}
          data-testid="crowd-radar-close"
          className="cursor-pointer rounded-full p-1.5 transition-opacity hover:opacity-70"
        >
          <IconX size={16} stroke={2.5} />
        </button>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Quietest to busiest, right now.
      </p>

      <ul className="flex flex-col gap-2">
        {ranked.length === 0 && (
          <li className="text-sm text-muted-foreground">Waiting for data…</li>
        )}
        {ranked.map((zone) => {
          const TrendIcon = TREND_ICON[zone.trend];
          return (
            <li
              key={zone.zone}
              data-testid={`crowd-radar-row-${zone.zone}`}
              className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CROWD_LEVEL_COLOR[zone.level] }}
                />
                <div>
                  <div className="text-sm font-medium">
                    {ZONE_LABEL[zone.zone] ?? zone.zone}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {zone.headline}
                  </div>
                </div>
              </div>
              <TrendIcon
                size={16}
                className={cn(
                  zone.trend === "worsening" && "text-red-400",
                  zone.trend === "improving" && "text-emerald-400",
                  zone.trend === "steady" && "text-muted-foreground"
                )}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

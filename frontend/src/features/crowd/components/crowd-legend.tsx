import { CROWD_LEVEL_COLOR } from "@/features/crowd/types";

const LEGEND_ITEMS: { label: string; level: keyof typeof CROWD_LEVEL_COLOR }[] = [
  { label: "Calm", level: "calm" },
  { label: "Filling", level: "moderate" },
  { label: "Busy", level: "busy" },
];

export function CrowdLegend() {
  return (
    <div
      data-testid="crowd-legend"
      className="pointer-events-none absolute bottom-4 left-4 z-40 flex items-center gap-3 rounded-full bg-background/90 px-4 py-2 text-xs shadow-md"
    >
      {LEGEND_ITEMS.map(({ label, level }) => (
        <span key={level} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: CROWD_LEVEL_COLOR[level] }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

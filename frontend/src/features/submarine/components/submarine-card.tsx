import type { SubmarineListItem } from "@/features/submarine/types";
import { cn } from "@/lib/utils";

interface SubmarineCardProps {
  submarine: SubmarineListItem;
  isOpen: boolean;
  onToggle: () => void;
}

export function SubmarineCard({
  submarine,
  isOpen,
  onToggle,
}: SubmarineCardProps) {
  return (
    <button
      type="button"
      data-testid={`submarine-card-${submarine.id}`}
      onClick={onToggle}
      className={cn(
        "flex w-full flex-col gap-1 rounded-md border-2 bg-background/70 px-4 py-3 text-left transition-colors",
        isOpen
          ? "border-(--zone-accent)/60 bg-[color-mix(in_srgb,var(--zone-accent)_6%,transparent)]"
          : "border-border/60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "text-sm font-semibold",
            isOpen ? "text-(--zone-accent)" : "text-foreground"
          )}
        >
          {submarine.name}
        </p>
        <span className="shrink-0 text-xs text-muted-foreground">
          {submarine.depth_zone}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{submarine.description}</p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {submarine.porthole_count} portholes · {submarine.total_seats} seats
      </p>
    </button>
  );
}

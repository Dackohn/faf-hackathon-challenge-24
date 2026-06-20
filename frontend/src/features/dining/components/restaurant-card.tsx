import type { RestaurantListItem } from "@/features/dining/types";
import { cn } from "@/lib/utils";

interface RestaurantCardProps {
  restaurant: RestaurantListItem;
  isOpen: boolean;
  onToggle: () => void;
}

export function RestaurantCard({
  restaurant,
  isOpen,
  onToggle,
}: RestaurantCardProps) {
  return (
    <button
      type="button"
      data-testid={`restaurant-card-${restaurant.id}`}
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
          {restaurant.name}
        </p>
        <span className="shrink-0 text-xs text-muted-foreground">
          {restaurant.cuisine}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{restaurant.description}</p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {restaurant.table_count} tables · {restaurant.total_seats} seats
      </p>
    </button>
  );
}

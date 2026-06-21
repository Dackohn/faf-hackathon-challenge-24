import { Button } from "@/components/ui/button";
import { IconLoader2 } from "@tabler/icons-react";
import type { PortholeAvailability } from "@/features/submarine/types";
import { cn } from "@/lib/utils";

interface PortholeRowProps {
  porthole: PortholeAvailability;
  isBooked: boolean;
  isBooking: boolean;
  onBook: () => void;
}

export function PortholeRow({
  porthole,
  isBooked,
  isBooking,
  onBook,
}: PortholeRowProps) {
  return (
    <div
      data-testid={`submarine-porthole-${porthole.id}`}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border px-3 py-2",
        isBooked ? "border-(--zone-accent)/60" : "border-border/60"
      )}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{porthole.label}</span>
        <span className="text-xs text-muted-foreground">{porthole.seats} seats</span>
      </div>
      <Button
        size="sm"
        data-testid="submarine-porthole-book"
        disabled={!porthole.available || isBooking}
        onClick={onBook}
        className="shrink-0"
      >
        {isBooking ? (
          <IconLoader2 size={13} className="animate-spin" />
        ) : !porthole.available ? (
          "Booked"
        ) : (
          "Dive"
        )}
      </Button>
    </div>
  );
}

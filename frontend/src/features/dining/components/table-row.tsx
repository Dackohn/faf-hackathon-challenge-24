import { Button } from "@/components/ui/button";
import { IconLoader2 } from "@tabler/icons-react";
import type { TableAvailability } from "@/features/dining/types";
import { cn } from "@/lib/utils";

interface TableRowProps {
  table: TableAvailability;
  isBooked: boolean;
  isBooking: boolean;
  onBook: () => void;
}

export function TableRow({ table, isBooked, isBooking, onBook }: TableRowProps) {
  return (
    <div
      data-testid={`dining-table-${table.id}`}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border px-3 py-2",
        isBooked ? "border-(--zone-accent)/60" : "border-border/60"
      )}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{table.label}</span>
        <span className="text-xs text-muted-foreground">{table.seats} seats</span>
      </div>
      <Button
        size="sm"
        data-testid="dining-table-book"
        disabled={!table.available || isBooking}
        onClick={onBook}
        className="shrink-0"
      >
        {isBooking ? (
          <IconLoader2 size={13} className="animate-spin" />
        ) : !table.available ? (
          "Booked"
        ) : (
          "Reserve"
        )}
      </Button>
    </div>
  );
}

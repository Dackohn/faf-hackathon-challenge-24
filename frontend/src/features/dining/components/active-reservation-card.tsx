import { Button } from "@/components/ui/button";
import { IconLoader2 } from "@tabler/icons-react";
import type { Reservation } from "@/features/dining/types";

interface ActiveReservationCardProps {
  reservation: Reservation;
  isCancelling: boolean;
  onCancel: () => void;
}

export function ActiveReservationCard({
  reservation,
  isCancelling,
  onCancel,
}: ActiveReservationCardProps) {
  return (
    <div
      data-testid="dining-active-reservation"
      className="flex items-center justify-between gap-2 rounded-md border-2 border-(--zone-accent)/60 bg-[color-mix(in_srgb,var(--zone-accent)_6%,transparent)] px-4 py-3"
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-(--zone-accent)">
          Table reserved
        </p>
        <p className="text-xs text-muted-foreground">
          Party of {reservation.party_size} · slot {reservation.seating_slot}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        data-testid="dining-cancel-reservation"
        disabled={isCancelling}
        onClick={onCancel}
        className="shrink-0"
      >
        {isCancelling ? (
          <IconLoader2 size={13} className="animate-spin" />
        ) : (
          "Cancel"
        )}
      </Button>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { IconLoader2, IconScubaMask } from "@tabler/icons-react";
import type { Dive } from "@/features/submarine/types";

interface ActiveDiveCardProps {
  dive: Dive;
  isCancelling: boolean;
  onCancel: () => void;
}

export function ActiveDiveCard({
  dive,
  isCancelling,
  onCancel,
}: ActiveDiveCardProps) {
  return (
    <div
      data-testid="submarine-active-dive"
      className="flex flex-col gap-2 rounded-md border-2 border-(--zone-accent)/60 bg-[color-mix(in_srgb,var(--zone-accent)_6%,transparent)] px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-(--zone-accent)">
            Dive booked
          </p>
          <p className="text-xs text-muted-foreground">
            Party of {dive.party_size} · departure slot {dive.dive_slot}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          data-testid="submarine-cancel-dive"
          disabled={isCancelling}
          onClick={onCancel}
          className="shrink-0"
        >
          {isCancelling ? (
            <IconLoader2 size={13} className="animate-spin" />
          ) : (
            "Surface"
          )}
        </Button>
      </div>

      {dive.briefing && (
        <div
          data-testid="submarine-briefing"
          className="flex gap-2 rounded-md border border-(--zone-accent)/40 bg-background/60 px-3 py-2"
        >
          <IconScubaMask
            size={16}
            className="mt-0.5 shrink-0 text-(--zone-accent)"
          />
          <p className="text-xs leading-relaxed text-foreground/90">
            {dive.briefing}
          </p>
        </div>
      )}
    </div>
  );
}

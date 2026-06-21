import { useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { SubmarineCard } from "@/features/submarine/components/submarine-card";
import { PortholeRow } from "@/features/submarine/components/porthole-row";
import { useAvailability } from "@/features/submarine/hooks/use-availability";
import { useSubmarines } from "@/features/submarine/hooks/use-submarines";
import { useDive } from "@/features/submarine/hooks/use-dive";

const PARTY_SIZE = 1;

export function SubmarinesList() {
  const { submarines, isLoading } = useSubmarines();
  const { dive, book, isBooking } = useDive();
  const [openSubmarineId, setOpenSubmarineId] = useState<string | null>(null);
  const { portholes, isLoading: isLoadingPortholes } = useAvailability(
    openSubmarineId
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (submarines.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No submarines available.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {submarines.map((submarine) => {
        const isOpen = openSubmarineId === submarine.id;
        return (
          <div key={submarine.id} className="flex flex-col gap-2">
            <SubmarineCard
              submarine={submarine}
              isOpen={isOpen}
              onToggle={() =>
                setOpenSubmarineId(isOpen ? null : submarine.id)
              }
            />
            {isOpen && (
              <div className="flex flex-col gap-1.5 pl-2">
                {isLoadingPortholes ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="size-5" />
                  </div>
                ) : (
                  portholes.map((porthole) => (
                    <PortholeRow
                      key={porthole.id}
                      porthole={porthole}
                      isBooked={
                        dive !== null && dive.porthole_id === porthole.id
                      }
                      isBooking={isBooking}
                      onBook={() =>
                        book(submarine.id, porthole.id, PARTY_SIZE)
                      }
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

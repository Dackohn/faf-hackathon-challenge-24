import { NotLandedGate } from "@/features/map/components/not-landed-gate";
import { ZoneEventLog } from "@/features/map/components/zone-event-log";
import { ZoneId } from "@/features/map/constants";
import { useZoneEvents } from "@/features/map/hooks/use-zone-events";
import { useLanded } from "@/features/airport/hooks/use-airport";
import { useCheckedIn } from "@/features/beach/hooks/use-checked-in";
import { NotCheckedInGate } from "@/features/dining/components/not-checked-in-gate";
import { RestaurantsList } from "@/features/dining/components/restaurants-list";
import { ActiveReservationCard } from "@/features/dining/components/active-reservation-card";
import { useReservation } from "@/features/dining/hooks/use-reservation";
import { useIsAdmin } from "@/stores/session-selectors";

export function DiningPanel() {
  const isAdmin = useIsAdmin();
  const events = useZoneEvents(ZoneId.Dining);
  const landed = useLanded();
  const checkedIn = useCheckedIn();
  const { reservation, cancel, isCancelling } = useReservation();

  if (isAdmin) {
    return <ZoneEventLog events={events} />;
  }

  return (
    <>
      {!landed ? (
        <NotLandedGate />
      ) : !checkedIn ? (
        <NotCheckedInGate />
      ) : (
        <div className="flex flex-col gap-3">
          {reservation && (
            <ActiveReservationCard
              reservation={reservation}
              isCancelling={isCancelling}
              onCancel={() => cancel(reservation.id)}
            />
          )}
          <RestaurantsList />
        </div>
      )}
    </>
  );
}

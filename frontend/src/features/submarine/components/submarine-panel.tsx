import { NotLandedGate } from "@/features/map/components/not-landed-gate";
import { ZoneEventLog } from "@/features/map/components/zone-event-log";
import { ZoneId } from "@/features/map/constants";
import { useZoneEvents } from "@/features/map/hooks/use-zone-events";
import { useLanded } from "@/features/airport/hooks/use-airport";
import { useCheckedIn } from "@/features/beach/hooks/use-checked-in";
import { NotCheckedInGate } from "@/features/submarine/components/not-checked-in-gate";
import { SubmarinesList } from "@/features/submarine/components/submarines-list";
import { ActiveDiveCard } from "@/features/submarine/components/active-dive-card";
import { useDive } from "@/features/submarine/hooks/use-dive";
import { useIsAdmin } from "@/stores/session-selectors";

export function SubmarinePanel() {
  const isAdmin = useIsAdmin();
  const events = useZoneEvents(ZoneId.Submarine);
  const landed = useLanded();
  const checkedIn = useCheckedIn();
  const { dive, cancel, isCancelling } = useDive();

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
          {dive && (
            <ActiveDiveCard
              dive={dive}
              isCancelling={isCancelling}
              onCancel={() => cancel(dive.id)}
            />
          )}
          <SubmarinesList />
        </div>
      )}
    </>
  );
}

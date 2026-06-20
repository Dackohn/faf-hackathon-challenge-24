import { useEffect, useRef } from "react";

import { getCrowdSnapshot } from "@/features/crowd/api/crowd-client";
import { CrowdSnapshotSchema, type ZoneCrowd } from "@/features/crowd/types";
import { useCrowdStore } from "@/stores/crowd-store";
import { useEventsStore } from "@/stores/events-store";
import { ChannelId } from "@/types/broadcast";

// Seeds the crowd store from the REST snapshot once, then keeps it live via
// the existing broadcast SSE stream's `crowd.update` events — no new connection.
export function useCrowd() {
  const applySnapshot = useCrowdStore((s) => s.applySnapshot);
  const latestBroadcastEvent = useEventsStore(
    (s) => s.events[ChannelId.Broadcast][0]
  );
  const lastAppliedEventId = useRef<string | null>(null);

  useEffect(() => {
    getCrowdSnapshot()
      .then((snapshot) => applySnapshot(snapshot.zones, snapshot.generated_at))
      .catch(() => {
        // initial fetch can fail before the broadcast service has ticked; SSE will catch up
      });
  }, [applySnapshot]);

  useEffect(() => {
    if (!latestBroadcastEvent) return;
    if (latestBroadcastEvent.event_type !== "crowd.update") return;
    if (latestBroadcastEvent.id === lastAppliedEventId.current) return;
    lastAppliedEventId.current = latestBroadcastEvent.id;

    const parsed = CrowdSnapshotSchema.safeParse(latestBroadcastEvent.data);
    if (parsed.success) {
      applySnapshot(parsed.data.zones, parsed.data.generated_at);
    }
  }, [latestBroadcastEvent, applySnapshot]);
}

export function useZoneCrowd(zone: string): ZoneCrowd | undefined {
  return useCrowdStore((s) => s.byZone[zone]);
}

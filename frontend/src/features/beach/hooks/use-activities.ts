import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getActivities } from "@/features/beach/api/beach-client";
import { BEACH_KEYS } from "@/features/beach/query-keys";
import { useEventsStore } from "@/stores/events-store";
import { ChannelId } from "@/types/broadcast";

export function useActivities() {
  const queryClient = useQueryClient();
  const beachTick = useEventsStore((s) => s.activityTick[ChannelId.Beach]);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: [...BEACH_KEYS.ACTIVITIES] });
  }, [beachTick, queryClient]);

  const query = useQuery({
    queryKey: [...BEACH_KEYS.ACTIVITIES],
    queryFn: getActivities,
    select: (data) => data.activities,
  });

  return {
    activities: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

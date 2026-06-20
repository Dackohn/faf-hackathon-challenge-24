import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getRestaurants } from "@/features/dining/api/dining-client";
import { DINING_KEYS } from "@/features/dining/query-keys";
import { useEventsStore } from "@/stores/events-store";
import { ChannelId } from "@/types/broadcast";

export function useRestaurants() {
  const queryClient = useQueryClient();
  const diningTick = useEventsStore((s) => s.activityTick[ChannelId.Dining]);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: [...DINING_KEYS.RESTAURANTS] });
  }, [diningTick, queryClient]);

  const query = useQuery({
    queryKey: [...DINING_KEYS.RESTAURANTS],
    queryFn: getRestaurants,
    select: (data) => data.restaurants,
  });

  return {
    restaurants: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

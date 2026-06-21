import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getSubmarines } from "@/features/submarine/api/submarine-client";
import { SUBMARINE_KEYS } from "@/features/submarine/query-keys";
import { useEventsStore } from "@/stores/events-store";
import { ChannelId } from "@/types/broadcast";

export function useSubmarines() {
  const queryClient = useQueryClient();
  const submarineTick = useEventsStore((s) => s.activityTick[ChannelId.Submarine]);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: [...SUBMARINE_KEYS.SUBMARINES] });
  }, [submarineTick, queryClient]);

  const query = useQuery({
    queryKey: [...SUBMARINE_KEYS.SUBMARINES],
    queryFn: getSubmarines,
    select: (data) => data.submarines,
  });

  return {
    submarines: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

import { useQuery } from "@tanstack/react-query";

import { getAvailability } from "@/features/submarine/api/submarine-client";
import { SUBMARINE_KEYS } from "@/features/submarine/query-keys";
import { getCurrentSimulationHour } from "@/lib/simulation-time";

export function useAvailability(submarineId: string | null) {
  const slot = getCurrentSimulationHour();

  const query = useQuery({
    queryKey: [...SUBMARINE_KEYS.AVAILABILITY, submarineId, slot],
    queryFn: () => getAvailability(submarineId!, slot),
    enabled: !!submarineId,
  });

  return {
    slot,
    portholes: query.data?.portholes ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

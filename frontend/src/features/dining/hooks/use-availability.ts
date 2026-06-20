import { useQuery } from "@tanstack/react-query";

import { getAvailability } from "@/features/dining/api/dining-client";
import { DINING_KEYS } from "@/features/dining/query-keys";
import { getCurrentSimulationHour } from "@/lib/simulation-time";

export function useAvailability(restaurantId: string | null) {
  const slot = getCurrentSimulationHour();

  const query = useQuery({
    queryKey: [...DINING_KEYS.AVAILABILITY, restaurantId, slot],
    queryFn: () => getAvailability(restaurantId!, slot),
    enabled: !!restaurantId,
  });

  return {
    slot,
    tables: query.data?.tables ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

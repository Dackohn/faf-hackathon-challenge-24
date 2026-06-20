import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getReservationByGuest,
  cancelReservation,
} from "@/features/hotel/api/hotel-client";
import { ApiRequestError } from "@/lib/api-client";
import { useSessionStore } from "@/stores/session-store";
import { HOTEL_KEYS } from "@/features/hotel/query-keys";

export function useActiveReservation() {
  const guest = useSessionStore((s) => s.guest);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...HOTEL_KEYS.RESERVATION, guest?.id],
    queryFn: async () => {
      try {
        return await getReservationByGuest(guest!.id);
      } catch (err) {
        // 404 means the guest has no active reservation (e.g. after a cancel).
        // Return null so the query resolves to "no reservation" instead of
        // erroring — otherwise react-query keeps the last booking on screen.
        if (err instanceof ApiRequestError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!guest,
  });

  const mutation = useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...HOTEL_KEYS.RESERVATION],
      });
      queryClient.invalidateQueries({ queryKey: [...HOTEL_KEYS.ROOMS] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    reservation: query.data ?? null,
    isLoading: query.isLoading,
    cancel: (id: string) => mutation.mutate(id),
    isCancelling: mutation.isPending,
  };
}

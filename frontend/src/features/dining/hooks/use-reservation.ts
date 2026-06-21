import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  bookTable,
  cancelReservation,
  getReservationsByGuest,
} from "@/features/dining/api/dining-client";
import { DINING_KEYS } from "@/features/dining/query-keys";
import { kikiReact } from "@/features/kiki/kiki-store";
import { getCurrentSimulationHour } from "@/lib/simulation-time";
import { useSessionStore } from "@/stores/session-store";

export function useReservation() {
  const guest = useSessionStore((s) => s.guest);
  const queryClient = useQueryClient();

  const reservationQuery = useQuery({
    queryKey: [...DINING_KEYS.RESERVATION, guest?.id],
    queryFn: () => getReservationsByGuest(guest!.id),
    enabled: !!guest,
    select: (data) => data.reservations[0] ?? null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [...DINING_KEYS.RESTAURANTS] });
    queryClient.invalidateQueries({ queryKey: [...DINING_KEYS.AVAILABILITY] });
    queryClient.invalidateQueries({
      queryKey: [...DINING_KEYS.RESERVATION, guest?.id],
    });
  };

  const bookMutation = useMutation({
    mutationFn: ({
      restaurantId,
      tableId,
      partySize,
    }: {
      restaurantId: string;
      tableId: string;
      partySize: number;
    }) =>
      bookTable({
        guest_id: guest!.id,
        restaurant_id: restaurantId,
        table_id: tableId,
        party_size: partySize,
        seating_slot: getCurrentSimulationHour(),
      }),
    onSuccess: () => {
      invalidate();
      kikiReact("dining_booked");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reservationId: string) => cancelReservation(reservationId),
    onSuccess: () => {
      invalidate();
      kikiReact("cancelled");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    reservation: reservationQuery.data ?? null,
    isLoadingReservation: reservationQuery.isLoading,
    book: (restaurantId: string, tableId: string, partySize: number) =>
      bookMutation.mutate({ restaurantId, tableId, partySize }),
    cancel: (reservationId: string) => cancelMutation.mutate(reservationId),
    isBooking: bookMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}

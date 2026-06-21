import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  bookDive,
  cancelDive,
  getDivesByGuest,
} from "@/features/submarine/api/submarine-client";
import { SUBMARINE_KEYS } from "@/features/submarine/query-keys";
import { kikiReact } from "@/features/kiki/kiki-store";
import { getCurrentSimulationHour } from "@/lib/simulation-time";
import { useSessionStore } from "@/stores/session-store";

export function useDive() {
  const guest = useSessionStore((s) => s.guest);
  const queryClient = useQueryClient();

  const diveQuery = useQuery({
    queryKey: [...SUBMARINE_KEYS.DIVE, guest?.id],
    queryFn: () => getDivesByGuest(guest!.id),
    enabled: !!guest,
    select: (data) => data.dives[0] ?? null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [...SUBMARINE_KEYS.SUBMARINES] });
    queryClient.invalidateQueries({ queryKey: [...SUBMARINE_KEYS.AVAILABILITY] });
    queryClient.invalidateQueries({
      queryKey: [...SUBMARINE_KEYS.DIVE, guest?.id],
    });
  };

  const bookMutation = useMutation({
    mutationFn: ({
      submarineId,
      portholeId,
      partySize,
    }: {
      submarineId: string;
      portholeId: string;
      partySize: number;
    }) =>
      bookDive({
        guest_id: guest!.id,
        submarine_id: submarineId,
        porthole_id: portholeId,
        party_size: partySize,
        dive_slot: getCurrentSimulationHour(),
      }),
    onSuccess: () => {
      invalidate();
      kikiReact("submarine_dived");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (diveId: string) => cancelDive(diveId),
    onSuccess: () => {
      invalidate();
      kikiReact("cancelled");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    dive: diveQuery.data ?? null,
    isLoadingDive: diveQuery.isLoading,
    book: (submarineId: string, portholeId: string, partySize: number) =>
      bookMutation.mutate({ submarineId, portholeId, partySize }),
    cancel: (diveId: string) => cancelMutation.mutate(diveId),
    isBooking: bookMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createActivity, deleteActivity } from "@/features/beach/api/beach-client";
import { BEACH_KEYS } from "@/features/beach/query-keys";
import { env } from "@/config/env";
import type { CreateActivityRequest } from "@/features/beach/types";

export function useAdminActivities() {
  const queryClient = useQueryClient();
  const passcode = env.adminPasscode;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [...BEACH_KEYS.ACTIVITIES] });

  const createMutation = useMutation({
    mutationFn: (body: CreateActivityRequest) => createActivity(body, passcode),
    onSuccess: () => {
      invalidate();
      toast.success("Activity created");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (activityId: string) => deleteActivity(activityId, passcode),
    onSuccess: () => {
      invalidate();
      toast.success("Activity removed");
    },
    onError: (err) => toast.error(err.message),
  });

  return {
    create: (body: CreateActivityRequest) => createMutation.mutate(body),
    remove: (activityId: string) => deleteMutation.mutate(activityId),
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    deletingId: deleteMutation.variables ?? null,
  };
}

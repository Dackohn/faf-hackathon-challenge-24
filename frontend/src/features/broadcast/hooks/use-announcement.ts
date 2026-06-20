import { useMutation } from "@tanstack/react-query";
import { postAnnouncement } from "@/features/broadcast/api/broadcast-client";
import { env } from "@/config/env";

export function useAnnouncement() {
  const { mutate, isPending, error } = useMutation({
    mutationFn: (message: string) => postAnnouncement(message, env.adminPasscode),
  });

  return { send: mutate, isPending, error };
}

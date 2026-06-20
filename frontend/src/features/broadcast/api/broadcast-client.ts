import { z } from "zod";
import { api } from "@/lib/api-client";

const AnnouncementResponseSchema = z.object({ success: z.boolean() });

export function postAnnouncement(message: string, passcode: string) {
  return api.broadcast.post(AnnouncementResponseSchema, "/announcement", { message }, {
    "X-Admin-Passcode": passcode,
  });
}

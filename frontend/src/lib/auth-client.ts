import axios from "axios";
import { z } from "zod";

import { env } from "@/config/env";

const TokenResponseSchema = z.object({ token: z.string() });

const authInstance = axios.create({ baseURL: env.gatewayUrl });

export async function loginGuest(guestId: string): Promise<string> {
  const { data } = await authInstance.post("/auth/guest", {
    guest_id: guestId,
  });
  return TokenResponseSchema.parse(data).token;
}

export async function loginAdmin(passcode: string): Promise<string> {
  const { data } = await authInstance.post("/auth/admin", { passcode });
  return TokenResponseSchema.parse(data).token;
}

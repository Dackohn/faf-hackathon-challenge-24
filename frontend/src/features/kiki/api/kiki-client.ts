import { z } from "zod";

import { api } from "@/lib/api-client";
import type { KikiTrigger } from "@/features/kiki/lib/quips";

const QuipResponseSchema = z.object({ quip: z.string() });

// Asks the backend (Parrot service) for a fresh AI-written Kiki line. Returns null
// on any failure — the caller already shows a canned line, so this is best-effort.
export async function fetchQuip(
  trigger: KikiTrigger,
  context?: string | null
): Promise<string | null> {
  try {
    const res = await api.parrot.post(QuipResponseSchema, "/quip", {
      trigger,
      context: context ?? null,
    });
    const quip = res.quip?.trim();
    return quip ? quip : null;
  } catch {
    return null;
  }
}

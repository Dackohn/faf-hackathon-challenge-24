import { create } from "zustand";

import type { ZoneCrowd } from "@/features/crowd/types";

interface CrowdState {
  byZone: Record<string, ZoneCrowd>;
  generatedAt: string | null;
  applySnapshot: (zones: ZoneCrowd[], generatedAt?: string) => void;
}

export const useCrowdStore = create<CrowdState>()((set) => ({
  byZone: {},
  generatedAt: null,

  applySnapshot: (zones, generatedAt) =>
    set((state) => ({
      byZone: {
        ...state.byZone,
        ...Object.fromEntries(zones.map((z) => [z.zone, z])),
      },
      generatedAt: generatedAt ?? state.generatedAt,
    })),
}));

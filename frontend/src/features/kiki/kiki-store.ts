import { create } from "zustand";

import { fetchQuip } from "@/features/kiki/api/kiki-client";
import { randomCanned, type KikiTrigger } from "@/features/kiki/lib/quips";

const COOLDOWN_MS = 4000; // min gap between any takes, so Kiki doesn't spam
const AI_COOLDOWN_MS = 8000; // min gap between LLM calls — token-budget guard
const SHOW_MS = 10000; // how long a take stays on screen

interface KikiState {
  text: string | null;
  visible: boolean;
  lastAt: number;
  lastAiAt: number;
  seq: number;
  /** React to something the guest did. Shows a canned line instantly, then swaps
   *  in a fresh AI line if it arrives while the same take is still on screen. */
  react: (trigger: KikiTrigger, context?: string | null) => void;
  /** Always-on poke (clicking Kiki) — ignores the cooldown, never calls the LLM. */
  poke: () => void;
  hide: () => void;
}

interface ShowOpts {
  force?: boolean;
  ai?: boolean;
}

export const useKikiStore = create<KikiState>((set, get) => {
  function show(trigger: KikiTrigger, context: string | null | undefined, opts: ShowOpts) {
    const now = Date.now();
    if (!opts.force && now - get().lastAt < COOLDOWN_MS) return;

    const seq = get().seq + 1;
    set({ text: randomCanned(trigger), visible: true, lastAt: now, seq });

    // Auto-hide if this take is still the current one.
    setTimeout(() => {
      if (get().seq === seq) set({ visible: false });
    }, SHOW_MS);

    // Only hit the LLM for deliberate guest actions, and at most once every
    // AI_COOLDOWN_MS — so frequent island events and rapid poking never burn tokens.
    // Everything still shows a hand-written line instantly regardless.
    if (opts.ai && now - get().lastAiAt >= AI_COOLDOWN_MS) {
      set({ lastAiAt: now });
      void fetchQuip(trigger, context).then((ai) => {
        if (ai && get().seq === seq && get().visible) set({ text: ai });
      });
    }
  }

  return {
    text: null,
    visible: false,
    lastAt: 0,
    lastAiAt: 0,
    seq: 0,
    // Island events ride on canned lines only (they're frequent); real actions use AI.
    react: (trigger, context) => show(trigger, context, { ai: trigger !== "island_event" }),
    poke: () => show("poke", null, { force: true, ai: false }),
    hide: () => set({ visible: false }),
  };
});

// Imperative helper so non-React call sites (mutation onSuccess handlers) can fire Kiki.
export function kikiReact(trigger: KikiTrigger, context?: string | null) {
  useKikiStore.getState().react(trigger, context);
}

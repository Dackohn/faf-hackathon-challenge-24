import { useEffect, useRef } from "react";

import kiki from "@/assets/kiki.png";
import { useKikiStore } from "@/features/kiki/kiki-store";
import { useEventsStore } from "@/stores/events-store";
import { useGuest, useIsAdmin } from "@/stores/session-selectors";
import { ChannelId } from "@/types/broadcast";

/**
 * Kiki's Hot Takes — an always-on sarcastic cat that pops a speech bubble when the
 * guest does something (driven by `kikiReact(...)` in the feature mutation hooks),
 * reacts occasionally to island-wide events, and quips when you poke her.
 *
 * Anchored to the TOP-LEFT, sized large so the take is hard to miss; the bubble
 * drops down under her with a bounce and stays for ~10s. Hidden for admins and on
 * the guest-selection screen.
 */
export function KikiHotTakes() {
  const isAdmin = useIsAdmin();
  const guest = useGuest();
  const text = useKikiStore((s) => s.text);
  const visible = useKikiStore((s) => s.visible);
  const seq = useKikiStore((s) => s.seq);
  const poke = useKikiStore((s) => s.poke);
  const react = useKikiStore((s) => s.react);

  // Greet once, shortly after a guest enters.
  const greetedRef = useRef(false);
  useEffect(() => {
    if (!guest) {
      greetedRef.current = false;
      return;
    }
    if (greetedRef.current) return;
    greetedRef.current = true;
    const t = setTimeout(() => react("greeting"), 1200);
    return () => clearTimeout(t);
  }, [guest, react]);

  // React now and then to whatever is happening elsewhere on the island (canned only).
  const latest = useEventsStore((s) => s.events[ChannelId.ResortWide][0]);
  const lastIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!latest || latest.id === lastIdRef.current) return;
    lastIdRef.current = latest.id;
    if (Math.random() < 0.3) react("island_event", latest.message);
  }, [latest, react]);

  if (isAdmin || !guest) return null;

  return (
    <div className="pointer-events-none fixed left-5 top-20 z-[70] flex flex-col items-start gap-3 select-none">
      <button
        key={seq + (visible ? "-pop" : "-idle")}
        type="button"
        onClick={poke}
        aria-label="Kiki"
        className={`pointer-events-auto relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-100 to-zinc-300 shadow-xl ring-4 ring-cyan-400/40 transition-transform hover:scale-110 active:scale-95 ${
          visible ? "animate-in zoom-in-75 duration-300" : ""
        }`}
      >
        <img src={kiki} alt="Kiki" className="h-full w-full object-contain p-1.5" draggable={false} />
        {visible && (
          <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400 text-xs font-black text-zinc-900">
            !
          </span>
        )}
      </button>

      {visible && text && (
        // key={seq} re-runs the entrance animation on every new take.
        <div
          key={seq}
          className="pointer-events-auto max-w-[340px] animate-in fade-in zoom-in-95 slide-in-from-top-3 rounded-2xl rounded-tl-md border-l-4 border-cyan-400 border-y border-r border-y-zinc-700 border-r-zinc-700 bg-zinc-900/95 px-5 py-3 text-[15px] font-medium leading-snug text-zinc-50 shadow-2xl"
        >
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-cyan-400">
            Kiki
          </span>
          {text}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { IconMountain, IconTrophy, IconRefresh } from "@tabler/icons-react";
import { useSessionStore } from "@/stores/session-store";
import {
  startHike,
  answerRiddle,
  getLeaderboard,
  getHikeStatus,
  type RiddleState,
  type LeaderboardEntry,
} from "../api/mountain-client";

type GamePhase = "idle" | "playing" | "summited";

export function MountainPanel() {
  const guest = useSessionStore((s) => s.guest);
  const guestId = guest?.id ?? null;

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [riddle, setRiddle] = useState<RiddleState | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [summitData, setSummitData] = useState<{ duration: number; skipped: number } | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLeaderboard(await getLeaderboard());
    } catch {}
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // Auto-start or restore hike when the panel opens
  useEffect(() => {
    if (!guestId || phase !== "idle") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const status = await getHikeStatus(guestId);
        if (cancelled) return;
        if (status.summited) {
          setPhase("summited");
          setSummitData({ duration: 0, skipped: status.skipped ?? 0 });
          return;
        }
        // Active or no hike — start fresh
        const state = await startHike(guestId);
        if (cancelled) return;
        setRiddle(state);
        setPhase("playing");
      } catch {
        // leave on idle if unreachable; user can retry
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId]);


  async function handleChoice(choice: number) {
    if (!guestId || !riddle || loading) return;
    setLoading(true);
    setShowHint(false);
    setFeedback(null);
    try {
      const result = await answerRiddle(guestId, choice);

      if (result.summited) {
        setPhase("summited");
        setSummitData({
          duration: result.duration_seconds ?? 0,
          skipped: result.skipped_count ?? 0,
        });
        fetchLeaderboard();
        return;
      }

      setFeedback({
        text: result.message ?? (result.correct ? "Correct path!" : "That path crumbles…"),
        ok: result.correct ?? false,
      });

      if (result.riddle) {
        setRiddle({
          step: result.step!,
          total_steps: result.total_steps!,
          riddle: result.riddle,
          paths: result.paths!,
          hint: result.hint!,
        });
      }
    } catch {
      setFeedback({ text: "The mountain is silent. Try again.", ok: false });
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPhase("idle");
    setRiddle(null);
    setFeedback(null);
    setShowHint(false);
    setSummitData(null);
    fetchLeaderboard();
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <IconMountain size={22} className="text-lime-400" />
        <h2 className="text-base font-semibold text-white">Mountain Trail</h2>
      </div>

      {/* Summited */}
      {phase === "summited" && summitData && (
        <div className="rounded-xl border border-lime-500/40 bg-lime-950/30 p-5 text-center flex flex-col gap-3">
          <div className="text-4xl">🏔️</div>
          <p className="text-lime-300 font-semibold text-lg">You reached the summit!</p>
          <p className="text-zinc-300 text-sm">
            Time: <span className="text-white font-mono">{summitData.duration.toFixed(1)}s</span>
            {" · "}
            Helped: <span className="text-white font-mono">{summitData.skipped}</span> riddle{summitData.skipped !== 1 ? "s" : ""}
          </p>
          <button
            onClick={handleReset}
            className="mt-2 mx-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-lime-600 hover:bg-lime-500 text-white text-sm font-medium transition-colors"
          >
            <IconRefresh size={14} /> Climb again
          </button>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && riddle && (
        <div className="relative rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 flex flex-col gap-4">
          {/* Progress */}
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Step {riddle.step + 1} / {riddle.total_steps}</span>
            <div className="flex gap-1">
              {Array.from({ length: riddle.total_steps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-5 rounded-full transition-colors ${
                    i < riddle.step ? "bg-lime-400" : i === riddle.step ? "bg-lime-600" : "bg-zinc-700"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Riddle text */}
          <p className="text-zinc-100 text-sm leading-relaxed italic">"{riddle.riddle}"</p>

          {/* Feedback */}
          {feedback && (
            <p className={`text-xs px-3 py-1.5 rounded-lg ${feedback.ok ? "bg-lime-900/40 text-lime-300" : "bg-red-900/40 text-red-300"}`}>
              {feedback.text}
            </p>
          )}

          {/* Path choices */}
          <div className="flex flex-col gap-2">
            {riddle.paths.map((path, i) => (
              <button
                key={i}
                disabled={loading}
                onClick={() => handleChoice(i)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:border-lime-500/60 hover:bg-zinc-700 text-zinc-200 text-sm text-left transition-all disabled:opacity-50"
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-zinc-700 text-zinc-300 text-xs flex items-center justify-center font-mono">
                  {i + 1}
                </span>
                {path}
              </button>
            ))}
          </div>

          {/* Parrot hint mascot */}
          <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1">
            {showHint && (
              <div className="max-w-[180px] rounded-lg bg-zinc-800 border border-amber-500/40 px-3 py-2 text-xs text-amber-200 shadow-lg animate-in fade-in slide-in-from-bottom-2">
                💡 {riddle.hint}
              </div>
            )}
            <button
              onClick={() => setShowHint((v) => !v)}
              title="Ask the Parrot for a hint"
              className="relative flex items-center justify-center w-10 h-10 rounded-full bg-zinc-800 border border-zinc-600 hover:border-amber-400 transition-colors shadow"
            >
              <span className="text-lg">🦜</span>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center animate-bounce">
                !
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Idle — shown only when not logged in or while auto-starting */}
      {phase === "idle" && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-5 flex flex-col items-center gap-4 text-center">
          <div className="text-5xl">🏔️</div>
          {guestId ? (
            <p className="text-zinc-400 text-sm animate-pulse">Preparing the trail…</p>
          ) : (
            <>
              <p className="text-zinc-300 text-sm leading-relaxed">
                Five riddles stand between you and the summit. Solve them to earn your place on the leaderboard.
              </p>
              <p className="text-zinc-500 text-xs">Sign in as a guest to begin the climb.</p>
            </>
          )}
        </div>
      )}

      {/* Leaderboard */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <IconTrophy size={13} className="text-amber-400" />
            Summit Leaderboard
          </div>
          <button onClick={fetchLeaderboard} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <IconRefresh size={13} />
          </button>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-2">No summits yet — be the first!</p>
        ) : (
          <div className="flex flex-col gap-1">
            {leaderboard.slice(0, 10).map((entry) => (
              <div key={entry.rank} className="flex items-center justify-between text-xs py-1 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 w-4 text-right">{entry.rank}.</span>
                  <span className="text-zinc-300 font-mono">{entry.guest_id}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-500">
                  <span className="font-mono text-zinc-300">{entry.duration_seconds.toFixed(1)}s</span>
                  {entry.skipped > 0 && <span className="text-amber-600">{entry.skipped} helped</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { IconMountain, IconTrophy, IconRefresh, IconClock } from "@tabler/icons-react";
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

const MAX_WRONG = 3;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function MountainPanel() {
  const guest = useSessionStore((s) => s.guest);
  const guestId = guest?.id ?? null;

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [riddle, setRiddle] = useState<RiddleState | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [summitData, setSummitData] = useState<{ duration: number; skipped: number } | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean; skip?: boolean } | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [choiceResult, setChoiceResult] = useState<"correct" | "wrong" | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const cancelRef = useRef(false);

  // Timer
  useEffect(() => {
    if (phase !== "playing" || startTime === null) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase, startTime]);

  const fetchLeaderboard = useCallback(async () => {
    try { setLeaderboard(await getLeaderboard()); } catch {}
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const beginHike = useCallback(async () => {
    if (!guestId) return;
    cancelRef.current = false;
    setLoading(true);
    setFeedback(null);
    setShowHint(false);
    setWrongAttempts(0);
    setSelectedChoice(null);
    setChoiceResult(null);
    try {
      const state = await startHike(guestId);
      if (cancelRef.current) return;
      setRiddle(state);
      setPhase("playing");
      setStartTime(Date.now());
      setElapsed(0);
    } catch {
      setPhase("idle");
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [guestId]);

  // Auto-start on mount / login
  useEffect(() => {
    if (!guestId) return;
    cancelRef.current = false;
    setLoading(true);
    (async () => {
      try {
        const status = await getHikeStatus(guestId);
        if (cancelRef.current) return;
        if (status.summited) {
          setPhase("summited");
          setSummitData({ duration: 0, skipped: status.skipped ?? 0 });
          return;
        }
        await beginHike();
      } catch {
        if (!cancelRef.current) setLoading(false);
      }
    })();
    return () => { cancelRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId]);

  async function handleChoice(choice: number) {
    if (!guestId || !riddle || loading) return;
    setLoading(true);
    setSelectedChoice(choice);
    setShowHint(false);
    setFeedback(null);
    setChoiceResult(null);
    try {
      const result = await answerRiddle(guestId, choice);

      if (result.summited) {
        setChoiceResult(result.correct ? "correct" : null);
        await new Promise(r => setTimeout(r, 400));
        setPhase("summited");
        setSummitData({ duration: result.duration_seconds ?? 0, skipped: result.skipped_count ?? 0 });
        fetchLeaderboard();
        return;
      }

      if (result.correct) {
        setChoiceResult("correct");
        setFeedback({ text: "Correct path! Ascending…", ok: true });
        await new Promise(r => setTimeout(r, 600));
        setWrongAttempts(0);
        setSelectedChoice(null);
        setChoiceResult(null);
        if (result.riddle) {
          setRiddle({
            step: result.step!,
            total_steps: result.total_steps!,
            riddle: result.riddle,
            paths: result.paths!,
            hint: result.hint!,
          });
        }
      } else if (result.was_skipped) {
        setFeedback({ text: result.message ?? "The Oracle guides you past this obstacle.", ok: false, skip: true });
        await new Promise(r => setTimeout(r, 700));
        setWrongAttempts(0);
        setSelectedChoice(null);
        setChoiceResult(null);
        if (result.riddle) {
          setRiddle({
            step: result.step!,
            total_steps: result.total_steps!,
            riddle: result.riddle,
            paths: result.paths!,
            hint: result.hint!,
          });
        }
      } else {
        setChoiceResult("wrong");
        const attempts = result.wrong_attempts ?? wrongAttempts + 1;
        setWrongAttempts(attempts);
        setFeedback({ text: result.message ?? "That path crumbles… try another.", ok: false });
      }
    } catch {
      setFeedback({ text: "The mountain is silent. Try again.", ok: false });
    } finally {
      setLoading(false);
      if (choiceResult !== "correct") setSelectedChoice(null);
    }
  }

  function handleReset() {
    setPhase("idle");
    setRiddle(null);
    setFeedback(null);
    setShowHint(false);
    setSummitData(null);
    setWrongAttempts(0);
    setSelectedChoice(null);
    setChoiceResult(null);
    fetchLeaderboard();
    beginHike();
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto text-white">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconMountain size={22} className="text-lime-400" />
          <h2 className="text-base font-semibold">Mountain Trail</h2>
        </div>
        {phase === "playing" && startTime !== null && (
          <div className="flex items-center gap-1 text-xs text-lime-300 font-mono bg-lime-950/50 px-2 py-1 rounded-full border border-lime-700/40">
            <IconClock size={11} />
            {formatTime(elapsed)}
          </div>
        )}
      </div>

      {/* Summited */}
      {phase === "summited" && summitData && (
        <div className="rounded-xl border border-lime-500/50 bg-gradient-to-b from-lime-950/60 to-zinc-900/60 p-5 text-center flex flex-col gap-3">
          <div className="text-5xl">🏔️</div>
          <p className="text-lime-300 font-bold text-lg">Summit reached!</p>
          <div className="flex justify-center gap-4 text-sm">
            <div className="flex flex-col items-center">
              <span className="text-zinc-400 text-xs uppercase tracking-wide">Time</span>
              <span className="text-white font-mono font-semibold">{formatTime(Math.round(summitData.duration))}</span>
            </div>
            <div className="w-px bg-zinc-700" />
            <div className="flex flex-col items-center">
              <span className="text-zinc-400 text-xs uppercase tracking-wide">Oracle helps</span>
              <span className="text-white font-mono font-semibold">{summitData.skipped}</span>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="mt-1 mx-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-lime-600 hover:bg-lime-500 text-white text-sm font-semibold transition-colors"
          >
            <IconRefresh size={14} /> Climb again
          </button>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && riddle && (
        <div className="relative rounded-xl border border-zinc-600 bg-zinc-900/80 p-4 flex flex-col gap-4">

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 shrink-0">Step {riddle.step + 1} / {riddle.total_steps}</span>
            <div className="flex gap-1 flex-1">
              {Array.from({ length: riddle.total_steps }).map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i < riddle.step ? "bg-lime-400" : i === riddle.step ? "bg-lime-500" : "bg-zinc-700"
                }`} />
              ))}
            </div>
          </div>

          {/* Oracle riddle */}
          <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-lime-400 mb-2 font-semibold">The Oracle speaks</p>
            <p className="text-white text-sm leading-relaxed font-medium">"{riddle.riddle}"</p>
          </div>

          {/* Wrong attempt dots */}
          {wrongAttempts > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Attempts:</span>
              <div className="flex gap-1">
                {Array.from({ length: MAX_WRONG }).map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
                    i < wrongAttempts ? "bg-red-400" : "bg-zinc-700"
                  }`} />
                ))}
              </div>
              <span className="text-xs text-zinc-400">{MAX_WRONG - wrongAttempts} left before Oracle steps in</span>
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${
              feedback.skip
                ? "bg-amber-950/60 border-amber-600/50 text-amber-200"
                : feedback.ok
                  ? "bg-emerald-950/60 border-emerald-600/50 text-emerald-100"
                  : "bg-red-950/60 border-red-600/50 text-red-200"
            }`}>
              <span>{feedback.skip ? "🦜" : feedback.ok ? "✓" : "✗"}</span>
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Path choices */}
          <div className="flex flex-col gap-2">
            {riddle.paths.map((path, i) => {
              const isSelected = selectedChoice === i;
              const isCorrect = isSelected && choiceResult === "correct";
              const isWrong = isSelected && choiceResult === "wrong";
              return (
                <button
                  key={i}
                  disabled={loading}
                  onClick={() => handleChoice(i)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-all duration-200 ${
                    isCorrect
                      ? "border-emerald-500 bg-emerald-900/50 text-emerald-100"
                      : isWrong
                        ? "border-red-500 bg-red-900/40 text-red-200"
                        : isSelected
                          ? "border-lime-500/80 bg-lime-900/30 text-white"
                          : "border-zinc-600 bg-zinc-800/60 hover:border-lime-500/60 hover:bg-zinc-700/60 text-white"
                  } disabled:cursor-not-allowed`}
                >
                  <span className={`shrink-0 w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold transition-colors ${
                    isCorrect ? "bg-emerald-500 text-white"
                    : isWrong ? "bg-red-500 text-white"
                    : "bg-zinc-700 text-zinc-200"
                  }`}>
                    {i + 1}
                  </span>
                  <span className="font-medium">{path}</span>
                </button>
              );
            })}
          </div>

          {/* Parrot hint */}
          <div className="flex flex-col items-end gap-1">
            {showHint && (
              <div className="w-full rounded-lg bg-amber-950/70 border border-amber-600/50 px-3 py-2.5 text-sm text-amber-100">
                <span className="font-semibold text-amber-300">Oracle hint: </span>{riddle.hint}
              </div>
            )}
            <button
              onClick={() => setShowHint(v => !v)}
              title="Ask the Oracle for a hint"
              className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/50 border border-amber-700/50 hover:border-amber-500 text-amber-300 text-xs font-medium transition-colors"
            >
              <span className="text-sm">🦜</span>
              <span>{showHint ? "Hide hint" : "Ask the Oracle"}</span>
              {!showHint && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-black text-[8px] font-bold flex items-center justify-center animate-bounce">!</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Idle */}
      {phase === "idle" && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-6 flex flex-col items-center gap-3 text-center">
          <div className="text-5xl">{loading ? "⏳" : "🏔️"}</div>
          {guestId ? (
            <p className="text-zinc-300 text-sm animate-pulse">
              {loading ? "The Oracle is preparing your trail…" : "Ready to climb"}
            </p>
          ) : (
            <>
              <p className="text-zinc-200 text-sm leading-relaxed">
                Five riddles stand between you and the summit.
              </p>
              <p className="text-zinc-400 text-xs">Sign in as a guest to begin the climb.</p>
            </>
          )}
        </div>
      )}

      {/* Leaderboard */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 uppercase tracking-wide">
            <IconTrophy size={13} className="text-amber-400" />
            Summit Leaderboard
          </div>
          <button onClick={fetchLeaderboard} className="text-zinc-500 hover:text-zinc-200 transition-colors">
            <IconRefresh size={13} />
          </button>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-zinc-500 text-xs text-center py-2">No summits yet — be the first!</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {leaderboard.slice(0, 10).map((entry, idx) => (
              <div key={entry.rank} className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg ${idx === 0 ? "bg-amber-950/40 border border-amber-700/30" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 text-right font-bold ${idx === 0 ? "text-amber-400" : idx === 1 ? "text-zinc-300" : idx === 2 ? "text-amber-700" : "text-zinc-600"}`}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${entry.rank}.`}
                  </span>
                  <span className="text-white font-mono">{entry.guest_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-zinc-200">{formatTime(Math.round(entry.duration_seconds))}</span>
                  {entry.skipped > 0 && <span className="text-amber-400 text-[10px]">{entry.skipped}× helped</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import axios from "axios";
import { env } from "@/config/env";
import { useSessionStore } from "@/stores/session-store";

const mountainApi = axios.create({ baseURL: `${env.gatewayUrl}/api/mountain` });

mountainApi.interceptors.request.use((config) => {
  const token = useSessionStore.getState().token;
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

export interface RiddleState {
  step: number;
  total_steps: number;
  riddle: string;
  paths: string[];
  hint: string;
}

export interface AnswerResult {
  correct: boolean;
  summited: boolean;
  was_skipped?: boolean;
  message?: string;
  duration_seconds?: number;
  skipped_count?: number;
  wrong_attempts?: number;
  attempts_left?: number;
  step?: number;
  total_steps?: number;
  riddle?: string;
  paths?: string[];
  hint?: string;
}

export interface LeaderboardEntry {
  rank: number;
  guest_id: string;
  duration_seconds: number;
  skipped: number;
}

export async function startHike(guestId: string): Promise<RiddleState> {
  const res = await mountainApi.post("/hike/start", { guest_id: guestId });
  return res.data;
}

export async function answerRiddle(guestId: string, choice: number): Promise<AnswerResult> {
  const res = await mountainApi.post("/hike/answer", { guest_id: guestId, choice });
  return res.data;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await mountainApi.get("/hike/leaderboard");
  return res.data.leaderboard;
}

export async function getHikeStatus(guestId: string) {
  const res = await mountainApi.get(`/hike/status/${guestId}`);
  return res.data;
}

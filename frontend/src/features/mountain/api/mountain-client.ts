import axios from "axios";
import { env } from "@/config/env";

const api = axios.create({ baseURL: `${env.gatewayUrl}/api/mountain` });

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
  skipped?: boolean;
  message?: string;
  duration_seconds?: number;
  skipped_count?: number;
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
  const res = await api.post("/hike/start", { guest_id: guestId });
  return res.data;
}

export async function answerRiddle(guestId: string, choice: number): Promise<AnswerResult> {
  const res = await api.post("/hike/answer", { guest_id: guestId, choice });
  return res.data;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await api.get("/hike/leaderboard");
  return res.data.leaderboard;
}

export async function getHikeStatus(guestId: string) {
  const res = await api.get(`/hike/status/${guestId}`);
  return res.data;
}

// Typed fetch helpers for the upstream services the crowd monitor polls.
// Each helper returns null on any failure (network error, non-2xx, timeout)
// so one dead backend never stops the others from scoring.

const FETCH_TIMEOUT_MS = 1_500;

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface AirportQueueGate {
  gate_id: string;
  gate_type: string;
  queue_size: number;
}

export interface AirportQueueResponse {
  gates: AirportQueueGate[];
  total_queued: number;
  current_game_time: number;
}

export async function fetchAirportQueue(): Promise<AirportQueueResponse | null> {
  const base = process.env.AIRPORT_SERVICE_URL;
  if (!base) return null;
  const data = await fetchJson(`${base.replace(/\/+$/, "")}/queue`);
  if (!data || typeof data !== "object") return null;
  return data as AirportQueueResponse;
}

export interface HotelRoom {
  capacity: number;
  occupancy: number;
}

export interface HotelRoomsResponse {
  rooms: HotelRoom[];
}

export async function fetchHotelRooms(): Promise<HotelRoomsResponse | null> {
  const base = process.env.HOTEL_SERVICE_URL;
  if (!base) return null;
  const data = await fetchJson(`${base.replace(/\/+$/, "")}/rooms`);
  if (!data || typeof data !== "object") return null;
  return data as HotelRoomsResponse;
}

export interface BeachActivity {
  activity_id: string;
  activity_name: string;
  capacity: number;
  remaining: number;
}

export async function fetchBeachActivities(): Promise<BeachActivity[] | null> {
  const base = process.env.BEACH_SERVICE_URL;
  if (!base) return null;
  const data = await fetchJson(`${base.replace(/\/+$/, "")}/activities`);
  const activities =
    data && typeof data === "object" && "activities" in data
      ? (data as { activities: unknown }).activities
      : data;
  if (!Array.isArray(activities)) return null;
  return activities as BeachActivity[];
}

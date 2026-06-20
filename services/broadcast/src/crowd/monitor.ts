// Polls airport/hotel/beach on a timer, scores each zone, caches the latest
// snapshot, and pushes it over the existing SSE bus as a `crowd.update` event.
// Services stay unaware of this — it only ever reads their public GET endpoints.

import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType, type CrowdSnapshot, type ZoneCrowd } from "../types.js";
import { fetchAirportQueue, fetchBeachActivities, fetchHotelRooms } from "./sources.js";
import { scoreAirport, scoreBeach, scoreHotel } from "./score.js";

let latest: CrowdSnapshot | null = null;
let previousByZone = new Map<string, number | null>();

function placeholderZone(zone: string): ZoneCrowd {
  return {
    zone,
    level: "unknown",
    load: null,
    trend: "steady",
    headline: "Waiting for first tick",
    detail: {},
  };
}

export function getLatestSnapshot(): CrowdSnapshot {
  if (latest) return latest;

  return {
    generated_at: new Date().toISOString(),
    game_time: null,
    zones: ["airport", "hotel", "beach"].map(placeholderZone),
  };
}

async function tick() {
  const [airportResult, hotelResult, beachResult] = await Promise.allSettled([
    fetchAirportQueue(),
    fetchHotelRooms(),
    fetchBeachActivities(),
  ]);

  const airportData = airportResult.status === "fulfilled" ? airportResult.value : null;
  const hotelData = hotelResult.status === "fulfilled" ? hotelResult.value : null;
  const beachData = beachResult.status === "fulfilled" ? beachResult.value : null;

  const zones: ZoneCrowd[] = [
    scoreAirport(airportData, previousByZone.get("airport")),
    scoreHotel(hotelData, previousByZone.get("hotel")),
    scoreBeach(beachData, previousByZone.get("beach")),
  ];

  previousByZone = new Map(zones.map((z) => [z.zone, z.load]));

  const gameTime =
    airportData && typeof airportData === "object" && "current_game_time" in airportData
      ? (airportData as { current_game_time: number }).current_game_time
      : null;

  latest = {
    generated_at: new Date().toISOString(),
    game_time: gameTime,
    zones,
  };

  broadcast({
    id: uuid(),
    channel: ChannelId.Broadcast,
    event_type: EventType.CROWD_UPDATE,
    message: "Crowd levels updated",
    sender: "crowd-monitor",
    data: { ...latest },
  });
}

export function startCrowdMonitor() {
  const intervalMs = Number(process.env.CROWD_POLL_INTERVAL_MS ?? 5000);
  void tick();
  setInterval(() => void tick(), intervalMs);
}

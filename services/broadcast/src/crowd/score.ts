// Pure scoring functions: raw upstream payload -> { load, headline, detail }.
// No I/O here so this module is trivially unit-testable.

import type { AirportQueueResponse, BeachActivity, HotelRoomsResponse } from "./sources.js";
import type { CrowdLevel, CrowdTrend, ZoneCrowd } from "../types.js";

const CALM_MAX = Number(process.env.CROWD_CALM_MAX ?? 0.34);
const BUSY_MIN = Number(process.env.CROWD_BUSY_MIN ?? 0.67);
const TREND_EPSILON = 0.03;

export function bucket(load: number | null): CrowdLevel {
  if (load === null) return "unknown";
  if (load < CALM_MAX) return "calm";
  if (load < BUSY_MIN) return "moderate";
  return "busy";
}

export function trend(prevLoad: number | null | undefined, currLoad: number | null): CrowdTrend {
  if (prevLoad == null || currLoad === null) return "steady";
  const delta = currLoad - prevLoad;
  if (delta > TREND_EPSILON) return "worsening";
  if (delta < -TREND_EPSILON) return "improving";
  return "steady";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function scoreAirport(
  data: AirportQueueResponse | null,
  prevLoad: number | null | undefined
): ZoneCrowd {
  if (!data) {
    return {
      zone: "airport",
      level: "unknown",
      load: null,
      trend: "steady",
      headline: "Airport status unavailable",
      detail: {},
    };
  }

  const softCapPerGate = Number(process.env.AIRPORT_QUEUE_SOFT_CAP ?? 10);
  const gates = data.gates?.length ?? 0;
  const totalQueued = data.total_queued ?? 0;
  const cap = gates * softCapPerGate;
  const load = cap > 0 ? Math.min(totalQueued / cap, 1) : 0;
  const rounded = round2(load);

  return {
    zone: "airport",
    level: bucket(rounded),
    load: rounded,
    trend: trend(prevLoad, rounded),
    headline: `${totalQueued} in queue across ${gates} gates`,
    detail: { total_queued: totalQueued, gates },
  };
}

export function scoreHotel(
  data: HotelRoomsResponse | null,
  prevLoad: number | null | undefined
): ZoneCrowd {
  if (!data) {
    return {
      zone: "hotel",
      level: "unknown",
      load: null,
      trend: "steady",
      headline: "Hotel status unavailable",
      detail: {},
    };
  }

  const rooms = data.rooms ?? [];
  const capacity = rooms.reduce((sum, r) => sum + (r.capacity ?? 0), 0);
  const occupied = rooms.reduce((sum, r) => sum + (r.occupancy ?? 0), 0);
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter((r) => (r.occupancy ?? 0) > 0).length;
  const freeRooms = totalRooms - occupiedRooms;
  const load = capacity > 0 ? Math.min(occupied / capacity, 1) : 0;
  const rounded = round2(load);

  return {
    zone: "hotel",
    level: bucket(rounded),
    load: rounded,
    trend: trend(prevLoad, rounded),
    headline: `${freeRooms} of ${totalRooms} rooms free`,
    detail: { occupied, capacity, occupiedRooms, totalRooms, freeRooms },
  };
}

export function scoreBeach(
  data: BeachActivity[] | null,
  prevLoad: number | null | undefined
): ZoneCrowd {
  if (!data) {
    return {
      zone: "beach",
      level: "unknown",
      load: null,
      trend: "steady",
      headline: "Beach status unavailable",
      detail: {},
    };
  }

  const capacity = data.reduce((sum, a) => sum + (a.capacity ?? 0), 0);
  const booked = data.reduce((sum, a) => sum + Math.max((a.capacity ?? 0) - (a.remaining ?? 0), 0), 0);
  const load = capacity > 0 ? Math.min(booked / capacity, 1) : 0;
  const rounded = round2(load);

  return {
    zone: "beach",
    level: bucket(rounded),
    load: rounded,
    trend: trend(prevLoad, rounded),
    headline:
      rounded >= BUSY_MIN
        ? "Most activities nearly full"
        : `${booked} of ${capacity} activity spots booked`,
    detail: { booked, capacity },
  };
}

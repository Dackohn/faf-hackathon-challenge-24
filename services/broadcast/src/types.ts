// Channels mirror the frontend ChannelId enum (frontend/src/types/broadcast.ts).
// The SSE consumer validates `channel` against exactly these values.
export enum ChannelId {
  Airport = "airport",
  Hotel = "hotel",
  Beach = "beach",
  Parrot = "parrot",
  Broadcast = "broadcast",
  ResortWide = "resort-wide",
}

export enum EventType {
  AIRPORT_ARRIVAL = "airport.arrival",

  HOTEL_CONFIRM = "hotel.reservation_confirmed",
  HOTEL_CANCEL = "hotel.reservation_cancelled",

  BEACH_FULL = "beach.activity_full",
  BEACH_AVAILABLE = "beach.activity_available",

  PUBLIC_ANNOUNCEMENT = "public.announcement",

  ANNOUNCEMENT_RESORT = "announcement.resort",

  PARROT_CURSED = "public.cursed",
}

// Wire shape streamed to SSE clients. Matches the frontend BroadcastEventSchema
// so every emitted event passes the client's Zod validation.
export interface IslandEvent {
  id: string;
  channel: ChannelId;
  event_type: string;
  message: string;
  sender: string;
  guest_id?: string;
  guest_name?: string;
  data?: Record<string, unknown>;
}

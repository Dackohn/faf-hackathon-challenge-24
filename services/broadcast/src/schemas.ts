// Concrete payload schemas for every broadcast endpoint.
// Each parse* function accepts an unknown body and returns the typed payload,
// or throws a ValidationError describing the first missing / wrong-typed field.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.trim() === "") {
    throw new ValidationError(`"${key}" must be a non-empty string`);
  }
  return v;
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !isFinite(v)) {
    throw new ValidationError(`"${key}" must be a finite number`);
  }
  return v;
}

function requireObject(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = obj[key];
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new ValidationError(`"${key}" must be an object`);
  }
  return v as Record<string, unknown>;
}

function asBody(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  return raw as Record<string, unknown>;
}

// ── Airport /arrival ─────────────────────────────────────────────────────────

export interface AirportArrivalData {
  guest_id: string;
  name: string;
  surname: string;
  age: number;
  passport_type: string;
  priority: string;
  disability: boolean;
  status: string;
  gate: string;
  queued_at: string;
  processed_at: string;
  wait_time_seconds: number;
}

export interface AirportArrivalBody {
  message: string;
  sender: string;
  data: AirportArrivalData;
}

export function parseAirportArrival(raw: unknown): AirportArrivalBody {
  const body = asBody(raw);
  const message = requireString(body, "message");
  const sender = typeof body.sender === "string" ? body.sender : "airport-service";
  const d = requireObject(body, "data");

  const data: AirportArrivalData = {
    guest_id:           requireString(d, "guest_id"),
    name:               requireString(d, "name"),
    surname:            requireString(d, "surname"),
    age:                requireNumber(d, "age"),
    passport_type:      requireString(d, "passport_type"),
    priority:           requireString(d, "priority"),
    disability:         typeof d.disability === "boolean" ? d.disability : false,
    status:             requireString(d, "status"),
    gate:               requireString(d, "gate"),
    queued_at:          requireString(d, "queued_at"),
    processed_at:       requireString(d, "processed_at"),
    wait_time_seconds:  requireNumber(d, "wait_time_seconds"),
  };

  return { message, sender, data };
}

// ── Hotel /confirm and /cancel ────────────────────────────────────────────────

export interface HotelEventPayload {
  message: string;
  reservation_id: string;
  guest_id: string;
  room_type: string;
  guest_count: number;
  check_in_day: number;
  check_out_day: number;
}

export interface HotelEventBody {
  type: string;
  payload: HotelEventPayload;
}

export function parseHotelEvent(raw: unknown): HotelEventBody {
  const body = asBody(raw);
  const type = requireString(body, "type");
  const p = requireObject(body, "payload");

  const payload: HotelEventPayload = {
    message:        requireString(p, "message"),
    reservation_id: requireString(p, "reservation_id"),
    guest_id:       requireString(p, "guest_id"),
    room_type:      requireString(p, "room_type"),
    guest_count:    requireNumber(p, "guest_count"),
    check_in_day:   requireNumber(p, "check_in_day"),
    check_out_day:  requireNumber(p, "check_out_day"),
  };

  return { type, payload };
}

// ── Beach /full and /available ────────────────────────────────────────────────

export interface BeachActivityData {
  activity_id: string;
  activity_name: string;
  remaining: number;
}

export interface BeachActivityBody {
  message: string;
  sender: string;
  data: BeachActivityData;
}

export function parseBeachActivity(raw: unknown): BeachActivityBody {
  const body = asBody(raw);
  const message = requireString(body, "message");
  const sender = typeof body.sender === "string" ? body.sender : "beach-service";
  const d = requireObject(body, "data");

  const data: BeachActivityData = {
    activity_id:   requireString(d, "activity_id"),
    activity_name: requireString(d, "activity_name"),
    remaining:     requireNumber(d, "remaining"),
  };

  return { message, sender, data };
}

// ── Public /announcement ──────────────────────────────────────────────────────

export interface PublicAnnouncementBody {
  message: string;
  guestName?: string;
}

export function parsePublicAnnouncement(raw: unknown): PublicAnnouncementBody {
  const body = asBody(raw);
  const message = requireString(body, "message");
  const guestName = typeof body.guestName === "string" ? body.guestName : undefined;
  return { message, guestName };
}

// ── Admin announcement ────────────────────────────────────────────────────────

export interface AnnouncementBody {
  message: string;
}

export function parseAnnouncement(raw: unknown): AnnouncementBody {
  const body = asBody(raw);
  return { message: requireString(body, "message") };
}

// ── Parrot /cursed ────────────────────────────────────────────────────────────

export interface ParrotCursedBody {
  guest_id: string;
  message: string;
  triggered_word: string[];
}

export function parseParrotCursed(raw: unknown): ParrotCursedBody {
  const body = asBody(raw);
  const guest_id = requireString(body, "guest_id");
  const message = requireString(body, "message");
  const tw = body["triggered_word"];
  if (!Array.isArray(tw) || tw.length === 0 || tw.some((w) => typeof w !== "string")) {
    throw new ValidationError('"triggered_word" must be a non-empty array of strings');
  }
  return { guest_id, message, triggered_word: tw as string[] };
}

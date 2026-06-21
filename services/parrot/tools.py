import json
import httpx
# MOUNTAIN_TOOL_SCHEMAS are mixed into GUEST_TOOL_SCHEMAS so they are only
# available when a guest_id is present — the hike and leaderboard tools need it.

from services import (
    get_airport_stats,
    get_airport_queue_status,
    get_hotel_rooms,
    get_guest_arrival_status,
    get_guest_reservation,
    get_guest_journey_status,
    get_guest_clearance_eta,
    get_room_availability,
    get_beach_activities,
    get_mountain_leaderboard,
    start_mountain_hike,
    answer_mountain_riddle,
)

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_airport_stats",
            "description": "Get aggregate airport statistics: total arrivals, processed count, average wait times, gate and passport distribution.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_airport_queue_status",
            "description": "Get current gate queue sizes and wait times at passport control. Returns aggregate info per gate (no personal guest details). Use this for any question about the airport, passport control, gates, or queues — including how they work.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_hotel_rooms",
            "description": "Get all hotel rooms with current availability, types, capacity, and pricing. Use this for any question that touches rooms, reservations, bookings, check-in/out, or how the hotel works — including general or definitional ones.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_room_availability",
            "description": "Get how many hotel rooms are free right now and, when none are, the soonest game-day a room frees (soonest_free_day / days_until_free). Use this to answer 'when will a room free up?' or 'how long until a room is available?'.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_beach_activities",
            "description": "Get all beach activities with their current remaining spots and capacity. Beach spots are capacity-based with no schedule, so this gives current availability — it cannot tell you WHEN a full activity will free a spot (that only happens if someone cancels).",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_mountain_leaderboard",
            "description": "Get the mountain summit leaderboard — the fastest guests who completed the trail challenge.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]

MOUNTAIN_TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_mountain_leaderboard",
            "description": "Get the mountain summit leaderboard — fastest guests who completed the trail challenge.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "start_mountain_hike",
            "description": "Start the mountain trail challenge for the current guest. Returns the first riddle and three path choices (0, 1, 2). Call this when the guest wants to climb the mountain or play the trail game.",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_id": {"type": "string", "description": "The guest ID"},
                },
                "required": ["guest_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "answer_mountain_riddle",
            "description": "Submit the guest's chosen path (0, 1, or 2) for the current mountain riddle. Call this after the guest picks a path.",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_id": {"type": "string", "description": "The guest ID"},
                    "choice": {"type": "integer", "description": "The path index chosen: 0, 1, or 2"},
                },
                "required": ["guest_id", "choice"],
            },
        },
    },
]

GUEST_TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_guest_arrival_status",
            "description": "Look up a specific guest's arrival and passport control status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_id": {"type": "string", "description": "The guest ID to look up, e.g. guest-kiki-0001"},
                },
                "required": ["guest_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_guest_reservation",
            "description": "Look up a specific guest's active hotel reservation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_id": {"type": "string", "description": "The guest ID to look up, e.g. guest-kiki-0001"},
                },
                "required": ["guest_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_guest_journey_status",
            "description": "Get a combined snapshot of the current guest's journey: their airport arrival / passport-control status AND their active hotel reservation, in a single call. Prefer this over the individual lookups when the guest asks something broad like 'where am I', 'what's my status', or 'am I all set for my stay'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_id": {"type": "string", "description": "The guest ID to look up, e.g. guest-kiki-0001"},
                },
                "required": ["guest_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_guest_clearance_eta",
            "description": "Estimate how long until the current guest clears passport control: returns estimated_seconds_until_cleared (game-seconds, 0 if already processed, null if it cannot be determined). Use this to answer 'how long until I clear passport control?' or 'when will I be through?'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_id": {"type": "string", "description": "The guest ID to look up, e.g. guest-kiki-0001"},
                },
                "required": ["guest_id"],
            },
        },
    },
]

_DISPATCH = {
    "get_airport_stats": lambda **_: get_airport_stats(),
    "get_airport_queue_status": lambda **_: get_airport_queue_status(),
    "get_hotel_rooms": lambda **_: get_hotel_rooms(),
    "get_room_availability": lambda **_: get_room_availability(),
    "get_beach_activities": lambda **_: get_beach_activities(),
    "get_mountain_leaderboard": lambda **_: get_mountain_leaderboard(),
    "get_guest_arrival_status": lambda *, guest_id, **_: get_guest_arrival_status(guest_id),
    "get_guest_reservation": lambda *, guest_id, **_: get_guest_reservation(guest_id),
    "get_guest_journey_status": lambda *, guest_id, **_: get_guest_journey_status(guest_id),
    "get_guest_clearance_eta": lambda *, guest_id, **_: get_guest_clearance_eta(guest_id),
    "start_mountain_hike": lambda *, guest_id, **_: start_mountain_hike(guest_id),
    "answer_mountain_riddle": lambda *, guest_id, choice, **_: answer_mountain_riddle(guest_id, choice),
}

# Tools that expose a single guest's private data. Their guest_id must be the
# authenticated caller's, never a value the model picked.
GUEST_SCOPED_TOOLS = frozenset(
    {"get_guest_arrival_status", "get_guest_reservation", "get_guest_journey_status",
     "get_guest_clearance_eta", "start_mountain_hike", "answer_mountain_riddle"}
)

async def execute_tool(name: str, arguments: dict | None, allowed_guest_id: str | None) -> str:
    fn = _DISPATCH.get(name)
    if fn is None:
        return json.dumps({"error": f"Unknown tool: {name}"})

    arguments = arguments or {}

    if name in GUEST_SCOPED_TOOLS:
        # Never trust the model-supplied guest_id: a guest could ask the assistant
        # to look up someone else's data. Force the request's own guest_id so a
        # guest-scoped tool can only ever read the authenticated caller's records.
        if not allowed_guest_id:
            return json.dumps({"error": "No guest is associated with this conversation."})
        arguments = {**arguments, "guest_id": allowed_guest_id}

    try:
        return await fn(**arguments)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return json.dumps({"error": "Not found"})
        return json.dumps({"error": f"Service returned {e.response.status_code}"})
    except (httpx.ConnectError, httpx.TimeoutException):
        return json.dumps({"error": f"Service unavailable for {name}"})

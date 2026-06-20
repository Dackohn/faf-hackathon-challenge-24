import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";
import { parseHotelEvent, ValidationError } from "../schemas.js";

const router = Router();

router.post("/confirm", (req, res) => {
  let body;
  try {
    body = parseHotelEvent(req.body);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  broadcast({
    id: uuid(),
    channel: ChannelId.Hotel,
    event_type: EventType.HOTEL_CONFIRM,
    message: body.payload.message,
    sender: "hotel-service",
    guest_id: body.payload.guest_id,
    data: body.payload,
  });

  res.json({ success: true });
});

router.post("/cancel", (req, res) => {
  let body;
  try {
    body = parseHotelEvent(req.body);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  broadcast({
    id: uuid(),
    channel: ChannelId.Hotel,
    event_type: EventType.HOTEL_CANCEL,
    message: body.payload.message,
    sender: "hotel-service",
    guest_id: body.payload.guest_id,
    data: body.payload,
  });

  res.json({ success: true });
});

export default router;

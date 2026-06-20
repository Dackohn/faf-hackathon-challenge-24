import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";
import { parseBeachActivity, ValidationError } from "../schemas.js";

const router = Router();

router.post("/full", (req, res) => {
  let body;
  try {
    body = parseBeachActivity(req.body);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  broadcast({
    id: uuid(),
    channel: ChannelId.Beach,
    event_type: EventType.BEACH_FULL,
    message: body.message,
    sender: body.sender,
    data: body.data as Record<string, unknown>,
  });

  res.json({ success: true });
});

router.post("/available", (req, res) => {
  let body;
  try {
    body = parseBeachActivity(req.body);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  broadcast({
    id: uuid(),
    channel: ChannelId.Beach,
    event_type: EventType.BEACH_AVAILABLE,
    message: body.message,
    sender: body.sender,
    data: body.data as Record<string, unknown>,
  });

  res.json({ success: true });
});

export default router;

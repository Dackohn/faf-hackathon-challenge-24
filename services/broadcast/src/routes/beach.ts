import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

const router = Router();

router.post("/full", (req, res) => {
  const { message, sender, data } = req.body ?? {};

  broadcast({
    id: uuid(),
    channel: ChannelId.Beach,
    event_type: EventType.BEACH_FULL,
    message: message ?? "A beach activity is now full.",
    sender: sender ?? "beach-service",
    data: data ?? {},
  });

  res.json({
    success: true,
  });
});

router.post("/available", (req, res) => {
  const { message, sender, data } = req.body ?? {};

  broadcast({
    id: uuid(),
    channel: ChannelId.Beach,
    event_type: EventType.BEACH_AVAILABLE,
    message: message ?? "A beach activity has spots available again.",
    sender: sender ?? "beach-service",
    data: data ?? {},
  });

  res.json({
    success: true,
  });
});

export default router;

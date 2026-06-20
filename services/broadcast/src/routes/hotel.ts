import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

const router = Router();

router.post("/confirm", (req, res) => {
  const { payload } = req.body ?? {};

  broadcast({
    id: uuid(),
    channel: ChannelId.Hotel,
    event_type: EventType.HOTEL_CONFIRM,
    message: payload?.message ?? "Hotel reservation confirmed.",
    sender: "hotel-service",
    guest_id: payload?.guest_id,
    data: payload ?? {},
  });

  res.json({
    success: true,
  });
});

router.post("/cancel", (req, res) => {
  const { payload } = req.body ?? {};

  broadcast({
    id: uuid(),
    channel: ChannelId.Hotel,
    event_type: EventType.HOTEL_CANCEL,
    message: payload?.message ?? "Hotel reservation cancelled.",
    sender: "hotel-service",
    guest_id: payload?.guest_id,
    data: payload ?? {},
  });

  res.json({
    success: true,
  });
});

export default router;

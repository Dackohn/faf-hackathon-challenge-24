import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

const router = Router();

router.post("/arrival", (req, res) => {
  const { channel, message, sender, data } = req.body ?? {};

  broadcast({
    id: uuid(),
    channel: (channel as ChannelId) ?? ChannelId.Airport,
    event_type: EventType.AIRPORT_ARRIVAL,
    message: message ?? "",
    sender: sender ?? "airport-service",
    guest_id: data?.guest_id,
    data: data ?? {},
  });

  res.json({
    success: true,
  });
});

export default router;

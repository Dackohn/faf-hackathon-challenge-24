import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";
import { parseAirportArrival, ValidationError } from "../schemas.js";

const router = Router();

router.post("/arrival", (req, res) => {
  let body;
  try {
    body = parseAirportArrival(req.body);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  broadcast({
    id: uuid(),
    channel: ChannelId.Airport,
    event_type: EventType.AIRPORT_ARRIVAL,
    message: body.message,
    sender: body.sender,
    guest_id: body.data.guest_id,
    data: body.data,
  });

  res.json({ success: true });
});

export default router;

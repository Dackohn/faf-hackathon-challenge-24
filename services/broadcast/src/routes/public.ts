import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";
import { parsePublicAnnouncement, ValidationError } from "../schemas.js";

const router = Router();

router.post("/", (req, res) => {
  let body;
  try {
    body = parsePublicAnnouncement(req.body);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  broadcast({
    id: uuid(),
    channel: ChannelId.ResortWide,
    event_type: EventType.PUBLIC_ANNOUNCEMENT,
    message: body.message,
    sender: body.guestName ?? "resort",
    guest_name: body.guestName,
    data: { message: body.message },
  });

  res.json({ success: true });
});

export default router;

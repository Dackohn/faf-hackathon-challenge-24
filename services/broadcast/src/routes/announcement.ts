import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";
import { parseAnnouncement, ValidationError } from "../schemas.js";

const router = Router();

router.post("/", (req, res) => {
  const adminPasscode = process.env.ADMIN_PASSCODE;

  if (!adminPasscode) {
    res.status(503).json({ error: "Admin access not configured" });
    return;
  }

  const provided = req.headers["x-admin-passcode"];
  if (!provided || provided !== adminPasscode) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let body;
  try {
    body = parseAnnouncement(req.body);
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
    event_type: EventType.ANNOUNCEMENT_RESORT,
    message: body.message,
    sender: "lighthouse",
    data: { message: body.message },
  });

  res.json({ success: true });
});

export default router;

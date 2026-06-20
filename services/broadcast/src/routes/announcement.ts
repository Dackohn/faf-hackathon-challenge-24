import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

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

  const { message } = req.body ?? {};
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  broadcast({
    id: uuid(),
    channel: ChannelId.ResortWide,
    event_type: EventType.ANNOUNCEMENT_RESORT,
    message: message.trim(),
    sender: "lighthouse",
    data: { message: message.trim() },
  });

  res.json({ success: true });
});

export default router;

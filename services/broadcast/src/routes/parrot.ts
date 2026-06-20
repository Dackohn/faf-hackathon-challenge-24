import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";
import { parseParrotCursed, ValidationError } from "../schemas.js";

const router = Router();

router.post("/cursed", (req, res) => {
  let body;
  try {
    body = parseParrotCursed(req.body);
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
    event_type: EventType.PARROT_CURSED,
    message: body.message,
    sender: "parrot",
    guest_id: body.guest_id,
    data: {
      guest_id: body.guest_id,
      message: body.message,
      triggered_word: body.triggered_word,
    },
  });

  res.json({ success: true });
});

export default router;

import { Router } from "express";
import { addClient, removeClient } from "../eventBus.js";

const router = Router();

router.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Open the stream right away and suggest a reconnect delay to the client.
  res.write("retry: 3000\n\n");

  addClient(res);

  req.on("close", () => {
    removeClient(res);
  });
});

export default router;
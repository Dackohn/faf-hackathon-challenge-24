import { Router } from "express";
import { addClient, removeClient } from "../eventBus.js";
import { buildTokenMap, resolveAllowedPrefixes } from "../access-policy.js";

// Built once at module load; env vars are fixed before listen() is called.
const TOKEN_MAP = buildTokenMap();

const router = Router();

router.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write("retry: 3000\n\n");

  const serviceToken = req.headers["x-service-token"] as string | undefined;
  const allowedPrefixes = resolveAllowedPrefixes(serviceToken, TOKEN_MAP);

  addClient(res, allowedPrefixes);

  req.on("close", () => {
    removeClient(res);
  });
});

export default router;

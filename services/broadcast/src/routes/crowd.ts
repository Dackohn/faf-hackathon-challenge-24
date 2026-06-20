import { Router } from "express";
import { getLatestSnapshot } from "../crowd/monitor.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(getLatestSnapshot());
});

export default router;

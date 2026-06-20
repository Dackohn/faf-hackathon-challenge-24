import { z } from "zod";

export const CrowdLevelSchema = z.enum(["calm", "moderate", "busy", "unknown"]);
export type CrowdLevel = z.infer<typeof CrowdLevelSchema>;

export const CrowdTrendSchema = z.enum(["improving", "steady", "worsening"]);
export type CrowdTrend = z.infer<typeof CrowdTrendSchema>;

export const ZoneCrowdSchema = z.object({
  zone: z.string(),
  level: CrowdLevelSchema,
  load: z.number().nullable(),
  trend: CrowdTrendSchema,
  headline: z.string(),
  detail: z.record(z.string(), z.unknown()).optional(),
});
export type ZoneCrowd = z.infer<typeof ZoneCrowdSchema>;

export const CrowdSnapshotSchema = z.object({
  generated_at: z.string(),
  game_time: z.number().nullable(),
  zones: z.array(ZoneCrowdSchema),
});
export type CrowdSnapshot = z.infer<typeof CrowdSnapshotSchema>;

export const CROWD_LEVEL_COLOR: Record<CrowdLevel, string> = {
  calm: "#34d399",
  moderate: "#fbbf24",
  busy: "#f87171",
  unknown: "#94a3b8",
};

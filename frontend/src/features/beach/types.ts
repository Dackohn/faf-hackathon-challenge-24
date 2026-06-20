import { z } from "zod";

export const ActivitySchema = z.object({
  activity_id: z.string(),
  activity_name: z.string(),
  description: z.string().nullish(),
  capacity: z.number().int(),
  remaining: z.number().int(),
});

export const ActivitiesResponseSchema = z.object({
  activities: z.array(ActivitySchema),
});

export const BookActivityRequestSchema = z.object({
  id: z.string(),
});

export const BookActivityResponseSchema = z.object({
  status: z.string(),
});

export const CancelActivityResponseSchema = z.object({
  status: z.string(),
});

export const ActivityByGuestResponseSchema = z.object({
  activity_id: z.string().nullable(),
});

export type Activity = z.infer<typeof ActivitySchema>;
export type ActivitiesResponse = z.infer<typeof ActivitiesResponseSchema>;
export type BookActivityRequest = z.infer<typeof BookActivityRequestSchema>;
export type BookActivityResponse = z.infer<typeof BookActivityResponseSchema>;
export type CancelActivityResponse = z.infer<
  typeof CancelActivityResponseSchema
>;
export type ActivityByGuestResponse = z.infer<
  typeof ActivityByGuestResponseSchema
>;

export const ActivityDetailSchema = z.object({
  activity_id: z.string(),
  activity_name: z.string(),
  description: z.string().nullish(),
  capacity: z.number().int(),
  remaining: z.number().int(),
  visitors: z.array(z.string()),
});

export const ActivitiesDetailResponseSchema = z.object({
  activities: z.array(ActivityDetailSchema),
});

export const CreateActivityRequestSchema = z.object({
  activity_id: z.string().min(1),
  activity_name: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().min(1),
});

export const DeleteActivityResponseSchema = z.object({
  status: z.string(),
});

export type ActivityDetail = z.infer<typeof ActivityDetailSchema>;
export type ActivitiesDetailResponse = z.infer<typeof ActivitiesDetailResponseSchema>;
export type CreateActivityRequest = z.infer<typeof CreateActivityRequestSchema>;
export type DeleteActivityResponse = z.infer<typeof DeleteActivityResponseSchema>;

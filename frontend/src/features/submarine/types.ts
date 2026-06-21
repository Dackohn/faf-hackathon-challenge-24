import { z } from "zod";

export const SubmarineListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  depth_zone: z.string(),
  description: z.string(),
  porthole_count: z.number().int(),
  total_seats: z.number().int(),
});

export const SubmarineListResponseSchema = z.object({
  submarines: z.array(SubmarineListItemSchema),
});

export const PortholeSchema = z.object({
  id: z.string(),
  label: z.string(),
  seats: z.number().int(),
});

export const SubmarineDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  depth_zone: z.string(),
  description: z.string(),
  portholes: z.array(PortholeSchema),
});

export const PortholeAvailabilitySchema = z.object({
  id: z.string(),
  label: z.string(),
  seats: z.number().int(),
  available: z.boolean(),
});

export const AvailabilityResponseSchema = z.object({
  submarine_id: z.string(),
  slot: z.number().int(),
  portholes: z.array(PortholeAvailabilitySchema),
});

export const DiveSchema = z.object({
  id: z.string(),
  guest_id: z.string(),
  submarine_id: z.string(),
  porthole_id: z.string(),
  party_size: z.number().int(),
  dive_slot: z.number().int(),
  briefing: z.string().nullable(),
  status: z.enum(["CONFIRMED", "CANCELLED"]),
});

export const DiveListResponseSchema = z.object({
  guest_id: z.string(),
  dives: z.array(DiveSchema),
});

export const CancelDiveResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
});

export const BookDiveRequestSchema = z.object({
  guest_id: z.string(),
  submarine_id: z.string(),
  porthole_id: z.string(),
  party_size: z.number().int().positive(),
  dive_slot: z.number().int().nonnegative(),
});

export type SubmarineListItem = z.infer<typeof SubmarineListItemSchema>;
export type SubmarineListResponse = z.infer<typeof SubmarineListResponseSchema>;
export type Porthole = z.infer<typeof PortholeSchema>;
export type SubmarineDetail = z.infer<typeof SubmarineDetailSchema>;
export type PortholeAvailability = z.infer<typeof PortholeAvailabilitySchema>;
export type AvailabilityResponse = z.infer<typeof AvailabilityResponseSchema>;
export type Dive = z.infer<typeof DiveSchema>;
export type DiveListResponse = z.infer<typeof DiveListResponseSchema>;
export type CancelDiveResponse = z.infer<typeof CancelDiveResponseSchema>;
export type BookDiveRequest = z.infer<typeof BookDiveRequestSchema>;

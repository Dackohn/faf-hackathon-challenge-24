import { z } from "zod";

export const RestaurantListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  cuisine: z.string(),
  description: z.string(),
  table_count: z.number().int(),
  total_seats: z.number().int(),
});

export const RestaurantListResponseSchema = z.object({
  restaurants: z.array(RestaurantListItemSchema),
});

export const TableSchema = z.object({
  id: z.string(),
  label: z.string(),
  seats: z.number().int(),
});

export const RestaurantDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  cuisine: z.string(),
  description: z.string(),
  tables: z.array(TableSchema),
});

export const TableAvailabilitySchema = z.object({
  id: z.string(),
  label: z.string(),
  seats: z.number().int(),
  available: z.boolean(),
});

export const AvailabilityResponseSchema = z.object({
  restaurant_id: z.string(),
  slot: z.number().int(),
  tables: z.array(TableAvailabilitySchema),
});

export const ReservationSchema = z.object({
  id: z.string(),
  guest_id: z.string(),
  restaurant_id: z.string(),
  table_id: z.string(),
  party_size: z.number().int(),
  seating_slot: z.number().int(),
  pre_order: z.array(z.string()).nullable(),
  status: z.enum(["CONFIRMED", "CANCELLED"]),
});

export const ReservationListResponseSchema = z.object({
  guest_id: z.string(),
  reservations: z.array(ReservationSchema),
});

export const CancelReservationResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
});

export const BookTableRequestSchema = z.object({
  guest_id: z.string(),
  restaurant_id: z.string(),
  table_id: z.string(),
  party_size: z.number().int().positive(),
  seating_slot: z.number().int().nonnegative(),
  pre_order: z.array(z.string()).nullable().optional(),
});

export type RestaurantListItem = z.infer<typeof RestaurantListItemSchema>;
export type RestaurantListResponse = z.infer<typeof RestaurantListResponseSchema>;
export type Table = z.infer<typeof TableSchema>;
export type RestaurantDetail = z.infer<typeof RestaurantDetailSchema>;
export type TableAvailability = z.infer<typeof TableAvailabilitySchema>;
export type AvailabilityResponse = z.infer<typeof AvailabilityResponseSchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type ReservationListResponse = z.infer<typeof ReservationListResponseSchema>;
export type CancelReservationResponse = z.infer<typeof CancelReservationResponseSchema>;
export type BookTableRequest = z.infer<typeof BookTableRequestSchema>;

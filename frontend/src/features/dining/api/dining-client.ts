import { api } from "@/lib/api-client";
import {
  AvailabilityResponseSchema,
  CancelReservationResponseSchema,
  ReservationListResponseSchema,
  ReservationSchema,
  RestaurantListResponseSchema,
  type AvailabilityResponse,
  type BookTableRequest,
  type CancelReservationResponse,
  type Reservation,
  type ReservationListResponse,
  type RestaurantListResponse,
} from "@/features/dining/types";

export function getRestaurants(): Promise<RestaurantListResponse> {
  return api.dining.get(RestaurantListResponseSchema, "/restaurants");
}

export function getAvailability(
  restaurantId: string,
  slot: number
): Promise<AvailabilityResponse> {
  return api.dining.get(
    AvailabilityResponseSchema,
    `/restaurants/${restaurantId}/availability?slot=${slot}`
  );
}

export function bookTable(body: BookTableRequest): Promise<Reservation> {
  return api.dining.post(ReservationSchema, "/reservations", body);
}

export function getReservationsByGuest(
  guestId: string
): Promise<ReservationListResponse> {
  return api.dining.get(
    ReservationListResponseSchema,
    `/reservations/by-guest/${guestId}`
  );
}

export function cancelReservation(
  reservationId: string
): Promise<CancelReservationResponse> {
  return api.dining.post(
    CancelReservationResponseSchema,
    `/reservations/${reservationId}/cancel`,
    {}
  );
}

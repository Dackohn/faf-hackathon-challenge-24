import { api, ApiRequestError } from "@/lib/api-client";
import {
  ReservationSchema,
  RoomsResponseSchema,
  CancelReservationResponseSchema,
  type PostReservationRequest,
  type Reservation,
  type RoomsResponse,
  type CancelReservationResponse,
} from "@/features/hotel/types";

export function getRooms(): Promise<RoomsResponse> {
  return api.hotel.get(RoomsResponseSchema, "/rooms");
}

export function postReservation(
  body: PostReservationRequest
): Promise<Reservation> {
  return api.hotel.post(ReservationSchema, "/reservation", body);
}

export async function getReservationByGuest(
  guestId: string
): Promise<Reservation | null> {
  try {
    return await api.hotel.get(
      ReservationSchema,
      `/reservation/by-guest/${guestId}`
    );
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function cancelReservation(
  id: string
): Promise<CancelReservationResponse> {
  return api.hotel.delete(CancelReservationResponseSchema, `/reservation/${id}`);
}

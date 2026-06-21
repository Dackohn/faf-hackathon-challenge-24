import { api } from "@/lib/api-client";
import {
  AvailabilityResponseSchema,
  CancelDiveResponseSchema,
  DiveListResponseSchema,
  DiveSchema,
  SubmarineListResponseSchema,
  type AvailabilityResponse,
  type BookDiveRequest,
  type CancelDiveResponse,
  type Dive,
  type DiveListResponse,
  type SubmarineListResponse,
} from "@/features/submarine/types";

export function getSubmarines(): Promise<SubmarineListResponse> {
  return api.submarine.get(SubmarineListResponseSchema, "/submarines");
}

export function getAvailability(
  submarineId: string,
  slot: number
): Promise<AvailabilityResponse> {
  return api.submarine.get(
    AvailabilityResponseSchema,
    `/submarines/${submarineId}/availability?slot=${slot}`
  );
}

export function bookDive(body: BookDiveRequest): Promise<Dive> {
  return api.submarine.post(DiveSchema, "/dives", body);
}

export function getDivesByGuest(guestId: string): Promise<DiveListResponse> {
  return api.submarine.get(
    DiveListResponseSchema,
    `/dives/by-guest/${guestId}`
  );
}

export function cancelDive(diveId: string): Promise<CancelDiveResponse> {
  return api.submarine.post(
    CancelDiveResponseSchema,
    `/dives/${diveId}/cancel`,
    {}
  );
}

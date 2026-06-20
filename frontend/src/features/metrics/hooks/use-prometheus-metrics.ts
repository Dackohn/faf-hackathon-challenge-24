import { useQuery } from "@tanstack/react-query";
import { queryInstant, queryRange } from "@/features/metrics/api/prometheus-client";

const RANGE_MIN = 15;
const STEP_S = 30;
const STALE = 30_000;

export function useGatewayRequestRate() {
  return useQuery({
    queryKey: ["metrics", "gateway-request-rate"],
    queryFn: () =>
      queryRange(`sum by (service) (rate(gateway_http_requests_total[2m]))`, RANGE_MIN, STEP_S),
    refetchInterval: STALE,
    staleTime: STALE,
  });
}

export function useSseClients() {
  return useQuery({
    queryKey: ["metrics", "sse-clients"],
    queryFn: () => queryRange("broadcast_sse_clients", RANGE_MIN, STEP_S),
    refetchInterval: STALE,
    staleTime: STALE,
  });
}

export function useHotelReservations() {
  return useQuery({
    queryKey: ["metrics", "hotel-reservations"],
    queryFn: () => queryInstant("hotel_reservations_total"),
    refetchInterval: STALE,
    staleTime: STALE,
  });
}

export function useBeachBookings() {
  return useQuery({
    queryKey: ["metrics", "beach-bookings"],
    queryFn: () => queryInstant("beach_bookings_total"),
    refetchInterval: STALE,
    staleTime: STALE,
  });
}

export function useParrotLlmLatency() {
  return useQuery({
    queryKey: ["metrics", "parrot-llm-latency"],
    queryFn: () =>
      queryRange(
        `rate(parrot_llm_request_duration_seconds_sum[2m]) / rate(parrot_llm_request_duration_seconds_count[2m])`,
        RANGE_MIN,
        STEP_S
      ),
    refetchInterval: STALE,
    staleTime: STALE,
  });
}

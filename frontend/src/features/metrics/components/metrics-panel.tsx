import { IconAlertCircle, IconRefreshCw } from "@tabler/icons-react";
import { Spinner } from "@/components/ui/spinner";
import { MetricLineChart } from "@/features/metrics/components/metric-line-chart";
import {
  useGatewayRequestRate,
  useSseClients,
  useHotelReservations,
  useBeachBookings,
  useParrotLlmLatency,
} from "@/features/metrics/hooks/use-prometheus-metrics";
import type { PrometheusInstantSample } from "@/features/metrics/api/prometheus-client";

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </div>
  );
}

function sumByLabel(samples: PrometheusInstantSample[], labelValue: string) {
  return samples
    .filter((s) => Object.values(s.labels).includes(labelValue))
    .reduce((acc, s) => acc + s.value, 0);
}

function MetricError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-muted-foreground">
      <IconAlertCircle size={14} className="shrink-0 text-destructive" />
      {message}
    </div>
  );
}

export function MetricsPanel() {
  const gateway = useGatewayRequestRate();
  const sse = useSseClients();
  const hotel = useHotelReservations();
  const beach = useBeachBookings();
  const parrot = useParrotLlmLatency();

  const isLoading = gateway.isLoading || sse.isLoading || hotel.isLoading || beach.isLoading || parrot.isLoading;
  const prometheusDown = gateway.isError && sse.isError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (prometheusDown) {
    return (
      <MetricError message="Cannot reach Prometheus. Make sure the stack is running and the service is healthy." />
    );
  }

  const hotelConfirmed = Math.round(sumByLabel(hotel.data ?? [], "confirmed"));
  const hotelCancelled = Math.round(sumByLabel(hotel.data ?? [], "cancelled"));
  const beachBooked = Math.round(sumByLabel(beach.data ?? [], "booked"));
  const beachFailed = Math.round(sumByLabel(beach.data ?? [], "failed"));

  const parrotSeries = (parrot.data ?? []).filter((s) => s.samples.some((p) => isFinite(p.value) && !isNaN(p.value)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Live resort metrics — last 15 min</p>
        <button
          onClick={() => { gateway.refetch(); sse.refetch(); hotel.refetch(); beach.refetch(); parrot.refetch(); }}
          className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconRefreshCw size={10} />
          Refresh
        </button>
      </div>

      {/* Gateway throughput */}
      {gateway.data ? (
        <MetricLineChart
          series={gateway.data}
          title="Gateway — requests/s by service"
          unit="/s"
          labelKey="service"
          formatValue={(v) => `${v.toFixed(3)}/s`}
        />
      ) : (
        <MetricError message="Gateway metrics unavailable." />
      )}

      {/* SSE clients */}
      {sse.data ? (
        <MetricLineChart
          series={sse.data}
          title="Broadcast — connected SSE clients"
          labelKey="instance"
          formatValue={(v) => `${Math.round(v)} clients`}
        />
      ) : (
        <MetricError message="Broadcast metrics unavailable." />
      )}

      {/* Parrot LLM latency */}
      {parrotSeries.length > 0 ? (
        <MetricLineChart
          series={parrotSeries}
          title="Parrot — avg LLM response time"
          unit="s"
          labelKey="instance"
          formatValue={(v) => `${v.toFixed(2)}s`}
        />
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Parrot — avg LLM response time</p>
          <p className="text-xs text-muted-foreground/60">No LLM calls recorded yet</p>
        </div>
      )}

      {/* Hotel counts */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Hotel — reservations (all time)</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Confirmed" value={hotelConfirmed} accent="#34d399" />
          <StatCard label="Cancelled" value={hotelCancelled} accent="#fb7185" />
        </div>
      </div>

      {/* Beach counts */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Beach — activity bookings (all time)</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Booked" value={beachBooked} accent="#fbbf24" />
          <StatCard label="Failed" value={beachFailed} accent="#94a3b8" />
        </div>
      </div>
    </div>
  );
}

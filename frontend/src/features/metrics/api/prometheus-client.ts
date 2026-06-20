import axios from "axios";
import { env } from "@/config/env";

const prometheusApi = axios.create({
  baseURL: `${env.gatewayUrl}/api/prometheus`,
});

export interface PrometheusRangeSample {
  timestamp: number;
  value: number;
}

export interface PrometheusRangeSeries {
  labels: Record<string, string>;
  samples: PrometheusRangeSample[];
}

export interface PrometheusInstantSample {
  labels: Record<string, string>;
  value: number;
}

export async function queryRange(
  query: string,
  minutes = 15,
  step = 30
): Promise<PrometheusRangeSeries[]> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - minutes * 60;
  const { data } = await prometheusApi.get("/api/v1/query_range", {
    params: { query, start, end: now, step },
  });
  if (data.status !== "success") return [];
  return (data.data.result as any[]).map((r) => ({
    labels: r.metric as Record<string, string>,
    samples: (r.values as [number, string][]).map(([ts, v]) => ({
      timestamp: ts * 1000,
      value: parseFloat(v),
    })),
  }));
}

export async function queryInstant(query: string): Promise<PrometheusInstantSample[]> {
  const { data } = await prometheusApi.get("/api/v1/query", {
    params: { query },
  });
  if (data.status !== "success") return [];
  return (data.data.result as any[]).map((r) => ({
    labels: r.metric as Record<string, string>,
    value: parseFloat(r.value[1]),
  }));
}

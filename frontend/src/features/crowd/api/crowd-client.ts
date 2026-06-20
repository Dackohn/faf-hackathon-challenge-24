import { api } from "@/lib/api-client";
import { CrowdSnapshotSchema, type CrowdSnapshot } from "@/features/crowd/types";

export function getCrowdSnapshot(): Promise<CrowdSnapshot> {
  return api.broadcast.get(CrowdSnapshotSchema, "/crowd");
}

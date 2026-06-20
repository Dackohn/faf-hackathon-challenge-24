import { useState } from "react";
import { IconAlertCircle, IconChevronDown, IconChevronRight, IconUsers } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { Spinner } from "@/components/ui/spinner";
import { getAdminActivitiesDetail } from "@/features/beach/api/beach-client";
import { BEACH_KEYS } from "@/features/beach/query-keys";
import { ActivityCard } from "@/features/beach/components/activity-card";
import { env } from "@/config/env";
import { POLL_INTERVAL_MS } from "@/lib/polling";
import type { ActivityDetail } from "@/features/beach/types";

function ActivityDetailCard({ activity }: { activity: ActivityDetail }) {
  const [expanded, setExpanded] = useState(false);
  const booked = activity.capacity - activity.remaining;

  return (
    <div className="flex flex-col">
      <ActivityCard
        activity={activity}
        action={
          booked > 0 ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <IconUsers size={12} />
              <span className="tabular-nums">{booked}</span>
              {expanded ? (
                <IconChevronDown size={12} />
              ) : (
                <IconChevronRight size={12} />
              )}
            </button>
          ) : undefined
        }
      />
      {expanded && booked > 0 && (
        <div className="ml-2 mt-1 flex flex-col gap-0.5 border-l-2 border-(--zone-accent)/30 pl-3">
          {activity.visitors.map((id) => (
            <span
              key={id}
              className="font-mono text-xs text-muted-foreground"
            >
              {id}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BeachAdminActivitiesSummary() {
  const { data, isLoading, error } = useQuery({
    queryKey: [...BEACH_KEYS.ACTIVITIES_DETAIL],
    queryFn: () => getAdminActivitiesDetail(env.adminPasscode),
    refetchInterval: POLL_INTERVAL_MS,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
          <p>{error?.message ?? "Activity state could not be loaded."}</p>
        </div>
      </div>
    );
  }

  const activities = data.activities;
  const totalRemaining = activities.reduce((sum, a) => sum + a.remaining, 0);
  const totalBooked = activities.reduce(
    (sum, a) => sum + (a.capacity - a.remaining),
    0
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-medium">Beach activities</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <IconUsers size={11} />
            {totalBooked}
          </span>
          <span>·</span>
          <span>{totalRemaining} slots left</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {activities.map((activity) => (
          <ActivityDetailCard key={activity.activity_id} activity={activity} />
        ))}
      </div>
    </div>
  );
}

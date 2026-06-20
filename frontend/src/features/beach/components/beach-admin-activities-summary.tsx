import { useState } from "react";
import { IconAlertCircle, IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getActivities } from "@/features/beach/api/beach-client";
import { BEACH_KEYS } from "@/features/beach/query-keys";
import { ActivityCard } from "@/features/beach/components/activity-card";
import { useAdminActivities } from "@/features/beach/hooks/use-admin-activities";
import { POLL_INTERVAL_MS } from "@/lib/polling";

const EMPTY_FORM = {
  activity_id: "",
  activity_name: "",
  description: "",
  capacity: "",
};

export function BeachAdminActivitiesSummary() {
  const { data, isLoading, error } = useQuery({
    queryKey: [...BEACH_KEYS.ACTIVITIES],
    queryFn: getActivities,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const { create, remove, isCreating, isDeleting, deletingId } = useAdminActivities();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const capacity = parseInt(form.capacity, 10);
    if (!form.activity_id || !form.activity_name || isNaN(capacity) || capacity <= 0) return;
    create({
      activity_id: form.activity_id.trim(),
      activity_name: form.activity_name.trim(),
      description: form.description.trim() || undefined,
      capacity,
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-medium">Beach activities</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{totalRemaining} slots left</span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => setShowForm((v) => !v)}
          >
            <IconPlus size={12} />
            Add
          </Button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 rounded-md border-2 border-dashed border-(--zone-accent)/40 bg-background/70 px-4 py-3"
        >
          <p className="text-xs font-semibold text-muted-foreground">New activity</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">ID</Label>
              <Input
                className="h-7 text-xs"
                placeholder="ACT021"
                value={form.activity_id}
                onChange={(e) => setForm((f) => ({ ...f, activity_id: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Capacity</Label>
              <Input
                className="h-7 text-xs"
                type="number"
                min={1}
                placeholder="10"
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Name</Label>
            <Input
              className="h-7 text-xs"
              placeholder="Kite Surfing"
              value={form.activity_name}
              onChange={(e) => setForm((f) => ({ ...f, activity_name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Description (optional)</Label>
            <Input
              className="h-7 text-xs"
              placeholder="Brief description…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-7 text-xs"
              disabled={isCreating}
            >
              {isCreating ? <IconLoader2 size={12} className="animate-spin" /> : "Create"}
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.activity_id}
            activity={activity}
            action={
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                disabled={isDeleting && deletingId === activity.activity_id}
                onClick={() => remove(activity.activity_id)}
              >
                {isDeleting && deletingId === activity.activity_id ? (
                  <IconLoader2 size={13} className="animate-spin" />
                ) : (
                  <IconTrash size={13} />
                )}
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}

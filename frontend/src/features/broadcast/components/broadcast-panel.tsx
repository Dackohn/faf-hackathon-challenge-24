import { useState } from "react";
import { IconActivityHeartbeat, IconLoader2, IconSend, IconTower } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EventLog } from "@/features/map/components/event-log";
import { ZoneId } from "@/features/map/constants";
import { getZone } from "@/features/map/zone-registry";
import { useAnnouncement } from "@/features/broadcast/hooks/use-announcement";
import { MetricsPanel } from "@/features/metrics/components/metrics-panel";
import { useEventsStore } from "@/stores/events-store";
import { useIsAdmin } from "@/stores/session-selectors";

const { channel } = getZone(ZoneId.Broadcast);

const VISIBLE_PREFIXES = ["public.", "announcement."];

function isPublicEvent(eventType: string) {
  return VISIBLE_PREFIXES.some((prefix) => eventType.startsWith(prefix));
}

type Tab = "events" | "metrics";

export function BroadcastPanel() {
  const isAdmin = useIsAdmin();
  const events = useEventsStore((s) => s.events[channel]);
  const { send, isPending } = useAnnouncement();

  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("events");

  const visible = isAdmin ? events : events.filter((e) => isPublicEvent(e.event_type));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isPending) return;
    send(trimmed, {
      onSuccess: () => setMessage(""),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            onClick={() => setTab("events")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "events"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <IconTower size={12} />
            Events
          </button>
          <button
            onClick={() => setTab("metrics")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "metrics"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <IconActivityHeartbeat size={12} />
            Metrics
          </button>
        </div>
      )}

      {tab === "events" ? (
        <>
          {isAdmin && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                className="h-7 text-xs"
                placeholder="Broadcast an announcement to all guests…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                disabled={isPending || !message.trim()}
              >
                {isPending ? (
                  <IconLoader2 size={12} className="animate-spin" />
                ) : (
                  <IconSend size={12} />
                )}
                Send
              </Button>
            </form>
          )}
          <EventLog events={visible} />
        </>
      ) : (
        <MetricsPanel />
      )}
    </div>
  );
}

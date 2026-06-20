import { Response } from "express";
import { IslandEvent } from "./types.js";
import { isAllowed } from "./access-policy.js";
import { sseClientsGauge, eventsTotal, publishErrorsTotal } from "./metrics.js";

interface Client {
  res: Response;
  allowedPrefixes: string[];
}

const clients: Client[] = [];

export function addClient(res: Response, allowedPrefixes: string[]) {
  clients.push({ res, allowedPrefixes });
  sseClientsGauge.inc();
}

export function removeClient(res: Response) {
  const index = clients.findIndex((c) => c.res === res);
  if (index > -1) {
    clients.splice(index, 1);
    sseClientsGauge.dec();
  }
}

export function broadcast(event: IslandEvent) {
  const frame = `id: ${event.id}\n` + `data: ${JSON.stringify(event)}\n\n`;

  let sent = 0;
  for (const client of clients) {
    if (isAllowed(event.event_type, client.allowedPrefixes)) {
      client.res.write(frame);
      sent++;
    }
  }

  eventsTotal.inc({ event_type: event.event_type });
  if (sent === 0) publishErrorsTotal.inc();

  console.log(`Broadcasted: ${event.event_type} -> ${sent}/${clients.length} clients`);
}

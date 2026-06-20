import { Response } from "express";
import { IslandEvent } from "./types.js";
import { isAllowed } from "./access-policy.js";

interface Client {
  res: Response;
  allowedPrefixes: string[];
}

const clients: Client[] = [];

export function addClient(res: Response, allowedPrefixes: string[]) {
  clients.push({ res, allowedPrefixes });
}

export function removeClient(res: Response) {
  const index = clients.findIndex((c) => c.res === res);
  if (index > -1) {
    clients.splice(index, 1);
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

  console.log(`Broadcasted: ${event.event_type} -> ${sent}/${clients.length} clients`);
}

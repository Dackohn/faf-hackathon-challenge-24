import { Response } from "express";
import { IslandEvent } from "./types.js";

const clients: Response[] = [];

export function addClient(res: Response) {
  clients.push(res);
}

export function removeClient(res: Response) {
  const index = clients.indexOf(res);

  if (index > -1) {
    clients.splice(index, 1);
  }
}

export function broadcast(event: IslandEvent) {
  // Emit as a default (unnamed) SSE message so the frontend's EventSource
  // `onmessage` handler receives it; named events would be ignored there.
  const frame = `id: ${event.id}\n` + `data: ${JSON.stringify(event)}\n\n`;

  for (const client of clients) {
    client.write(frame);
  }

  console.log("Broadcasted:", event.event_type, "->", clients.length, "clients");
}

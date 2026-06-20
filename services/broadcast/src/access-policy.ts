export const PUBLIC_PREFIXES = ["public.", "announcement."];

const SERVICE_POLICY: Record<string, string[]> = {
  airport:  ["airport."],
  hotel:    ["airport.", "hotel."],
  beach:    ["hotel.", "beach."],
  parrot:   ["airport.", "hotel."],
  frontend: PUBLIC_PREFIXES,
};

// Reads the per-service token env vars and builds a reverse lookup: token → service name.
// Called once at module load so env vars are resolved before the first request.
export function buildTokenMap(): Map<string, string> {
  const entries: [string, string][] = [
    ["AIRPORT_TOKEN", "airport"],
    ["HOTEL_TOKEN",   "hotel"],
    ["BEACH_TOKEN",   "beach"],
    ["PARROT_TOKEN",  "parrot"],
    ["FE_TOKEN",      "frontend"],
  ];
  const map = new Map<string, string>();
  for (const [envVar, serviceName] of entries) {
    const token = process.env[envVar];
    if (token) map.set(token, serviceName);
  }
  return map;
}

export function resolveAllowedPrefixes(
  serviceToken: string | undefined,
  tokenMap: Map<string, string>
): string[] {
  if (!serviceToken) return PUBLIC_PREFIXES;
  const serviceName = tokenMap.get(serviceToken);
  return SERVICE_POLICY[serviceName ?? ""] ?? PUBLIC_PREFIXES;
}

export function isAllowed(eventType: string, allowedPrefixes: string[]): boolean {
  return allowedPrefixes.some((prefix) => eventType.startsWith(prefix));
}

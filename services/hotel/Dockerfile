# NestJS reservation service (Prisma + PostgreSQL).
# Single stage on purpose: entrypoint.sh runs `prisma migrate deploy` at startup, so the
# Prisma CLI (a devDependency) must survive into the running image — we don't prune dev deps.
FROM node:22-bookworm-slim
WORKDIR /app

# openssl/ca-certificates are needed by Prisma's engines.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec prisma generate \
    && pnpm run build

ENV PORT=3000
EXPOSE 3000
# entrypoint.sh: prisma migrate deploy -> seed -> start (dist/src/main.js)
CMD ["sh", "./entrypoint.sh"]

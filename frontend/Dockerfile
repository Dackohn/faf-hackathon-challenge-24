# React + Vite web app.
# The Vite config notes the dev server is the deploy target (it sets allowedHosts), so we
# run it directly. VITE_* values come from .env via compose's env_file at container start.
FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]

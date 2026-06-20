# Flask passport-control service, served by gunicorn.
# One worker only: create_app() spawns the gate-simulation background threads at import,
# so multiple workers would run multiple competing simulations.
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=3001
EXPOSE 3001
CMD ["sh", "-c", "gunicorn -w 1 --threads 4 -b 0.0.0.0:${PORT} app:app"]

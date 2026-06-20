FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=3001
EXPOSE 3001

CMD ["gunicorn", "app:app", \
     "--bind", "0.0.0.0:3001", \
     "--workers", "1", \
     "--threads", "8", \
     "--timeout", "120"]

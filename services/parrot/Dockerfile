# FastAPI LLM assistant, served by uvicorn.
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=3003
EXPOSE 3003
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]

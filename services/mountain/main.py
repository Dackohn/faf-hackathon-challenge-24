import logging
import uvicorn
from fastapi import FastAPI
from routes import router
from config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s level=%(levelname)s logger=%(name)s %(message)s",
)

app = FastAPI(title="Mountain Trail Service")
app.include_router(router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=settings.port)

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from broadcast import close_client
from config import settings
from database import close_engine, create_all, ensure_database_exists
from routes import router
from seed import seed_if_empty
from tracing import request_id_ctx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s level=%(levelname)s logger=%(name)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await ensure_database_exists()
        await create_all()
        await seed_if_empty()
        logger.info("Database schema ready")
    except Exception:
        logger.exception("Failed to initialize database schema")
    yield
    await close_client()
    await close_engine()


async def request_context(request: Request, call_next):
    rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    request.state.request_id = rid
    request_id_ctx.set(rid)
    start = time.perf_counter()
    response = await call_next(request)
    logger.info(
        "rid=%s method=%s path=%s status=%s dur_ms=%.1f",
        rid, request.method, request.url.path, response.status_code,
        (time.perf_counter() - start) * 1000,
    )
    response.headers["X-Request-ID"] = rid
    return response


def create_app() -> FastAPI:
    app = FastAPI(title="Submarine Service", lifespan=lifespan)
    app.middleware("http")(request_context)
    app.include_router(router)
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.port)

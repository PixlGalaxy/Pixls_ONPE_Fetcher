import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

import actas_controller
import scheduler
import storage
import predictor
from config import BASE_DIR, DATA_DIR, ELECTIONS
from AI.rag import rag_engine

load_dotenv(Path(__file__).parent / ".env")

LOG_PATH = DATA_DIR / "logs" / "onpe_backend.log"
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
LLM_MODEL: str = os.getenv("OLLAMA_LLM_MODEL", "llama3.2")

SYSTEM_PROMPT = (
    "Eres un asistente llamado Bit, experto en análisis electoral peruano para las elecciones de 2026. "
    "Tienes acceso a datos en tiempo real del ONPE (Oficina Nacional de Procesos Electorales). "
    "Zona horaria: América/Lima (UTC-5, Perú). Usa esta zona para interpretar fechas y horas. "
    "Respondes SIEMPRE en español, de forma precisa, concisa y objetiva. "
    "No inventes cifras; si no tienes datos suficientes, indícalo claramente.\n\n"
    "REGLAS CRÍTICAS PARA INTERPRETAR LOS DATOS:\n"
    "1. El bloque 'RESULTADOS ACTUALES PRESIDENCIALES' contiene el RANKING NACIONAL OFICIAL y DEFINITIVO. "
    "Este ranking prevalece siempre sobre cualquier dato regional o provincial.\n"
    "2. Los datos por DEPARTAMENTO o PROVINCIA reflejan resultados LOCALES que pueden diferir "
    "del ranking nacional. Un candidato puede liderar en una región y ser 5to nacionalmente.\n"
    "3. Usa SIEMPRE el ranking nacional para afirmaciones sobre posiciones (1ro, 2do, 3ro, etc.). "
    "Solo usa datos regionales cuando la pregunta sea específicamente sobre una región.\n"
    "4. No confundas posición regional con posición nacional.\n"
    "5. El bloque 'PREDICCIÓN MONTE CARLO PRESIDENCIAL' contiene resultados de simulación estadística real "
    "con miles de escenarios. Cuando el usuario pregunte sobre probabilidades, chances o predicciones, "
    "DEBES usar los campos 'Prob.posición' (P(#2), P(#3), etc.) de ese bloque como respuesta directa. "
    "NUNCA digas que no tienes datos de simulación si ese bloque está presente en el contexto. "
    "NUNCA hagas tu propio análisis de escenarios cuando ya tienes probabilidades calculadas.\n\n"
    "DATOS ELECTORALES ACTUALES (recuperados por búsqueda semántica RAG):\n{context}"
)

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


def _configure_uvicorn_logging() -> None:
    fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    formatter = logging.Formatter(fmt)

    class _AccessMsgFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            args = record.args
            if isinstance(args, tuple) and len(args) == 5:
                client, method, path, http_ver, status = args
                record.msg = (
                    f'[BACKEND-API] {client} - "{method} {path} HTTP/{http_ver}" {status}'
                )
                record.args = ()
            return True

    access = logging.getLogger("uvicorn.access")
    for h in list(access.handlers):
        access.removeHandler(h)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    file_handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
    file_handler.setFormatter(formatter)

    access.addHandler(stream_handler)
    access.addHandler(file_handler)
    access.propagate = False
    access.addFilter(_AccessMsgFilter())

    uvicorn_logger = logging.getLogger("uvicorn")
    for h in list(uvicorn_logger.handlers):
        uvicorn_logger.removeHandler(h)
    uvicorn_logger.propagate = True

    class _RenameUvicornFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            record.name = "uvicorn"
            return True

    logging.getLogger("uvicorn.error").addFilter(_RenameUvicornFilter())


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_uvicorn_logging()
    logger.info("Backend starting up…")
    actas_controller.start()
    scheduler.start()
    asyncio.create_task(rag_engine.initialize())
    yield
    logger.info("Backend shutting down…")
    scheduler.stop()
    actas_controller.stop()


# ── App ────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ONPE Election Data API",
    description=(
        "Continuously fetches and stores Peruvian election results from ONPE. "
        "Data is refreshed only when the actas contabilizadas percentage changes."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://devapp.zaylar.com",
        "https://itzgalaxy.com",
        "http://localhost:5173",
        "http://localhost:5000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── LLM origin guard - CORS ──────────────────────────────────────────────────────

_LLM_ALLOWED_ORIGINS = {
    "https://devapp.zaylar.com",
    "https://itzgalaxy.com",
    "http://localhost:5173",
    "http://localhost:5000",
}


async def _require_llm_origin(origin: str | None = Header(default=None)) -> None:
    if origin not in _LLM_ALLOWED_ORIGINS:
        raise HTTPException(status_code=403, detail="Origin not allowed")


# ── Utility ───────────────────────────────────────────────────────────────

def _require_election(key: str) -> dict:
    if key not in ELECTIONS:
        raise HTTPException(
            status_code=404,
            detail=f"Election '{key}' not found. Valid keys: {list(ELECTIONS)}",
        )
    return ELECTIONS[key]


# ── Root / status ──────────────────────────────────────────────────────────

@app.get("/")
def root():
    meta = storage.load_metadata()
    return {
        "api": "ONPE Election Data Backend",
        "version": "1.0.0",
        "status": "running",
        "last_full_fetch": meta.get("last_full_fetch"),
        "elections": list(ELECTIONS.keys()),
    }


@app.get("/status")
def get_status():
    meta = storage.load_metadata()
    meta["scheduler"] = scheduler.get_scheduler_info()
    return meta


# ── Election data ──────────────────────────────────────────────────────────

@app.get("/elections")
def list_elections():
    return {
        key: {
            "label": cfg["label"],
            "election_id": cfg["id"],
        }
        for key, cfg in ELECTIONS.items()
    }


@app.get("/elections/{election_key}")
def get_election_current(election_key: str):
    _require_election(election_key)
    data = storage.load_current(election_key)
    if data is None:
        raise HTTPException(status_code=404, detail="No data yet. Trigger /fetch/now first.")
    return data


@app.get("/elections/{election_key}/history")
def get_election_history(election_key: str):
    _require_election(election_key)
    return {
        "election": election_key,
        "snapshots": storage.load_history(election_key),
    }


@app.get("/elections/{election_key}/timeline")
def get_election_timeline(election_key: str):
    _require_election(election_key)
    data = storage._read(storage._election_dir(election_key) / "timeline.json")
    if data is None:
        raise HTTPException(status_code=404, detail="No timeline data yet.")
    return data


# ── Geographic data ────────────────────────────────────────────────────────

@app.get("/geographic/regions")
def get_all_regions(election: str = Query(default="presidential")):
    _require_election(election)
    regions = storage.load_all_geographic(election, "regions")
    if not regions:
        raise HTTPException(
            status_code=404,
            detail="No regional data yet. Trigger /fetch/now first.",
        )
    return {"election": election, "regions": regions}


@app.get("/geographic/regions/{ubigeo}")
def get_region(ubigeo: str, election: str = Query(default="presidential")):
    _require_election(election)
    data = storage.load_geographic(election, "regions", ubigeo)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail=f"No data for region ubigeo={ubigeo}. Run /fetch/now first.",
        )
    return data


@app.get("/geographic/provinces/{ubigeo}", include_in_schema=False)
def get_province(ubigeo: str, election: str = Query(default="presidential")):
    _require_election(election)
    cached = storage.load_geographic(election, "provinces", ubigeo)
    if cached:
        return cached
    try:
        snapshot = scheduler.fetch_geographic_on_demand(election, "province", ubigeo)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"ONPE fetch failed: {exc}") from exc
    return snapshot


@app.get("/geographic/districts/{ubigeo}", include_in_schema=False)
def get_district(ubigeo: str, election: str = Query(default="presidential")):
    _require_election(election)
    cached = storage.load_geographic(election, "districts", ubigeo)
    if cached:
        return cached
    try:
        snapshot = scheduler.fetch_geographic_on_demand(election, "district", ubigeo)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"ONPE fetch failed: {exc}") from exc
    return snapshot


@app.get("/geographic/abroad")
def get_abroad(election: str = Query(default="presidential")):
    _require_election(election)
    data = storage.load_abroad(election)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail="No abroad data yet. Trigger /fetch/now first.",
        )
    return data


# ── Operations ────────────────────────────────────────────────────────────

@app.post("/fetch/now")
def force_fetch():
    try:
        scheduler.trigger_now()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Fetch failed: {exc}") from exc
    return {"status": "ok", "message": "Full refresh completed."}


# ── Actas ─────────────────────────────────────────────────────────────────

_ACTAS_DIR = BASE_DIR / "Actas_Data"


def _safe_actas_path(rel: str) -> Path:
    target = (_ACTAS_DIR / rel).resolve()
    if not str(target).startswith(str(_ACTAS_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")
    return target


@app.get("/actas/status")
def actas_status():
    return actas_controller.get_status()


@app.get("/actas/browse")
@app.get("/actas/browse/{rel_path:path}")
def actas_browse(rel_path: str = ""):
    base = _ACTAS_DIR.resolve()
    target = _safe_actas_path(rel_path) if rel_path else base
    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Not a directory; use /actas/file/…")
    items = []
    for entry in sorted(target.iterdir()):
        stat = entry.stat()
        items.append({
            "name":     entry.name,
            "type":     "dir" if entry.is_dir() else "file",
            "size":     stat.st_size if entry.is_file() else None,
            "rel_path": entry.relative_to(base).as_posix(),
        })
    return {
        "path":  target.relative_to(base).as_posix() if target != base else "",
        "items": items,
    }


@app.get("/actas/file/{rel_path:path}")
def actas_file(rel_path: str):
    target = _safe_actas_path(rel_path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(target)


# ── Predictions ───────────────────────────────────────────────────────────

@app.get("/predictions")
def get_predictions():
    data = storage._read(predictor.PREDICTION_PATH)
    if data is None:
        raise HTTPException(status_code=404, detail="No prediction data yet.")
    return data


@app.post("/predictions/run")
def run_prediction_now():
    result = predictor.run_prediction()
    if result is None:
        raise HTTPException(status_code=500, detail="Prediction failed, insufficient data.")
    return result


# ── LLM Chat (Ollama + RAG, SSE streaming) ───────────────────────────────
# YEAH, I LOVE OLLAMA <3 - PIXL
@app.post("/LLM", dependencies=[Depends(_require_llm_origin)])
async def llm_chat(request: Request, body: ChatRequest):
    async def generate():
        ollama_client = httpx.AsyncClient(
            timeout=None,
            limits=httpx.Limits(max_keepalive_connections=0, max_connections=1),
        )
        cancel_task: asyncio.Task | None = None

        async def _cancel_on_disconnect() -> None:
            while True:
                await asyncio.sleep(0.4)
                if await request.is_disconnected():
                    logger.info("[LLM] Client disconnected, canceling Ollama stream")
                    await ollama_client.aclose()
                    return

        try:
            yield _sse({"type": "status", "status": "loading_model"})

            last_user = next(
                (m.content for m in reversed(body.messages) if m.role == "user"), ""
            )
            context = await rag_engine.get_context(last_user, k=8)

            if await request.is_disconnected():
                logger.info("[LLM] Client disconnected before calling Ollama")
                return

            system_content = SYSTEM_PROMPT.format(context=context)
            messages = [{"role": "system", "content": system_content}] + [
                {"role": m.role, "content": m.content} for m in body.messages
            ]

            cancel_task = asyncio.create_task(_cancel_on_disconnect())

            first_chunk = True
            stream_done = False

            async with ollama_client.stream(
                "POST",
                f"{OLLAMA_URL}/api/chat",
                headers={"Connection": "close"},
                json={"model": LLM_MODEL, "messages": messages, "stream": True,
                      "keep_alive": "2m", "think": True},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    chunk = json.loads(line)
                    if first_chunk:
                        yield _sse({"type": "status", "status": "model_loaded"})
                        yield _sse({"type": "status", "status": "inference"})
                        first_chunk = False
                    content = chunk.get("message", {}).get("content", "")
                    if content:
                        yield _sse({"type": "token", "content": content})
                    if chunk.get("done"):
                        stream_done = True
                        break

            await ollama_client.aclose()
            logger.debug("[LLM] Ollama connection closed after generating response")

            if stream_done:
                yield _sse({"type": "done"})
                return

        except (httpx.RemoteProtocolError, httpx.ReadError, httpx.StreamClosed):
            logger.info("[LLM] Ollama stream interrupted due to client disconnection")
        except Exception as exc:
            logger.error("[LLM] Error: %s", exc)
            try:
                yield _sse({"type": "error", "message": str(exc)})
            except Exception:
                pass
        finally:
            await ollama_client.aclose()
            if cancel_task:
                cancel_task.cancel()
                try:
                    await cancel_task
                except asyncio.CancelledError:
                    pass
            logger.debug("[LLM] ollama_client closed")

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


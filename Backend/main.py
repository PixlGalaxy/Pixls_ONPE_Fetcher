import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import scheduler
import storage
import predictor
from config import ELECTIONS

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("onpe_backend.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Backend starting up…")
    scheduler.start()
    yield
    logger.info("Backend shutting down…")
    scheduler.stop()


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
    """Return the consolidated timeline.json for charting."""
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


@app.get("/geographic/provinces/{ubigeo}")
def get_province(ubigeo: str, election: str = Query(default="presidential")):
    """
    Returns cached province data if available; otherwise fetches from ONPE
    on demand and caches the result.
    """
    _require_election(election)
    cached = storage.load_geographic(election, "provinces", ubigeo)
    if cached:
        return cached
    try:
        snapshot = scheduler.fetch_geographic_on_demand(election, "province", ubigeo)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"ONPE fetch failed: {exc}") from exc
    return snapshot


@app.get("/geographic/districts/{ubigeo}")
def get_district(ubigeo: str, election: str = Query(default="presidential")):
    """
    Returns cached district data if available; otherwise fetches from ONPE
    on demand and caches the result.
    """
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
    """Trigger an immediate full refresh from ONPE."""
    try:
        scheduler.trigger_now()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Fetch failed: {exc}") from exc
    return {"status": "ok", "message": "Full refresh completed."}


# ── Predictions ───────────────────────────────────────────────────────────

@app.get("/predictions")
def get_predictions():
    """Return the latest prediction results."""
    data = storage._read(predictor.PREDICTION_PATH)
    if data is None:
        raise HTTPException(status_code=404, detail="No prediction data yet.")
    return data


@app.post("/predictions/run")
def run_prediction_now():
    """Force a new prediction run."""
    result = predictor.run_prediction()
    if result is None:
        raise HTTPException(status_code=500, detail="Prediction failed — insufficient data.")
    return result




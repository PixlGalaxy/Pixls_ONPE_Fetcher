import json
import logging
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from config import BASE_DIR, DATA_DIR

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────

STATUS_PATH    = DATA_DIR / "actas_status.json"
ACTAS_DATA_DIR = BASE_DIR / "Actas_Data"

_PERU_TOTAL_DISTRICTS = 1874

# ── Internal state ─────────────────────────────────────────────────────────────

_thread: Optional[threading.Thread] = None
_stop_event  = threading.Event()
_lock        = threading.Lock()
_status: dict = {}
_needs_first_download = False

# ── Status helpers ─────────────────────────────────────────────────────────────

def _default_status() -> dict:
    return {
        "status":           "idle",
        "triggered_at_pct": None,
        "session_date":     None,
        "started_at":       None,
        "completed_at":     None,
        "last_updated":     None,
        "progress": {
            "completed_districts": 0,
            "total_districts":     _PERU_TOTAL_DISTRICTS,
            "total_downloaded":    0,
            "total_errors":        0,
            "total_skipped":       0,
            "current_location":    None,
            "eta_seconds":         None,
        },
        "history": [],
    }


def _load_status() -> dict:
    if STATUS_PATH.exists():
        try:
            with open(STATUS_PATH, encoding="utf-8") as f:
                data = json.load(f)
            default = _default_status()
            for k, v in default.items():
                data.setdefault(k, v)
            data["progress"].setdefault("total_districts", _PERU_TOTAL_DISTRICTS)
            return data
        except Exception:
            pass
    return _default_status()


def _save_status() -> None:
    _status["last_updated"] = datetime.now(timezone.utc).isoformat()
    try:
        STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(STATUS_PATH, "w", encoding="utf-8") as f:
            json.dump(_status, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.warning("[ACTAS] Could not save status: %s", exc)


def _read_scraper_progress() -> dict:
    state_path = ACTAS_DATA_DIR / "download_state.json"
    if not state_path.exists():
        return {}
    try:
        with open(state_path, encoding="utf-8") as f:
            data = json.load(f)
        completed = data.get("completed_keys", [])
        return {
            "completed_districts": len(completed),
            "total_downloaded":    data.get("total_downloaded", 0),
            "total_errors":        data.get("total_errors", 0),
            "total_skipped":       data.get("total_skipped", 0),
            "current_location":    completed[-1] if completed else None,
        }
    except Exception:
        return {}


# ── Public: get_status ────────────────────────────────────────────────────────

def get_status() -> dict:
    with _lock:
        s = dict(_status)
        s["progress"] = dict(_status["progress"])

    if s.get("status") == "downloading":
        prog = _read_scraper_progress()
        if prog:
            s["progress"].update(prog)
            started = s.get("started_at")
            done    = s["progress"].get("completed_districts", 0)
            total   = s["progress"].get("total_districts", _PERU_TOTAL_DISTRICTS)
            if started and done > 0:
                try:
                    elapsed = (
                        datetime.now(timezone.utc)
                        - datetime.fromisoformat(started)
                    ).total_seconds()
                    pending = max(total - done, 0)
                    eta_secs = int(elapsed / done * pending)
                    s["progress"]["eta_seconds"] = eta_secs
                    s["progress"]["eta_human"] = str(timedelta(seconds=eta_secs))
                except Exception:
                    pass

    return s


# ── Download thread ────────────────────────────────────────────────────────────

def _run_download(trigger_pct: float, resume: bool) -> None:
    global _status

    from ImageRecognition.acta_scraper import ActaScraper

    logger.info(
        "[ACTAS] Download thread starting (int_pct=%d%%, resume=%s)",
        int(trigger_pct), resume,
    )

    final_status = "error"
    scraper: Optional[ActaScraper] = None

    try:
        if not resume:
            state_path = ACTAS_DATA_DIR / "download_state.json"
            if state_path.exists():
                state_path.unlink()
                logger.info("[ACTAS] Cleared old download state (fresh start)")

        scraper = ActaScraper(
            output_dir=ACTAS_DATA_DIR,
            headless=True,
            rate_limit=0.25,
        )
        scraper.setup()

        with _lock:
            _status["session_date"] = scraper.session_date
            _save_status()

        logger.info("[ACTAS] Scraper ready, session=%s", scraper.session_date)

        scraper.run_peru()
        if not _stop_event.is_set():
            scraper.run_abroad()

        final_status = "completed" if not _stop_event.is_set() else "interrupted"
        with _lock:
            _status.pop("error", None)

    except Exception as exc:
        logger.error("[ACTAS] Download error: %s", exc, exc_info=True)
        with _lock:
            _status["error"] = str(exc)

    finally:
        if scraper:
            try:
                scraper.cleanup()
            except Exception:
                pass

    prog = _read_scraper_progress()

    with _lock:
        _status["status"]       = final_status
        _status["completed_at"] = datetime.now(timezone.utc).isoformat()
        if prog:
            _status["progress"].update(prog)
        _status["progress"]["current_location"] = None
        _status["progress"]["eta_seconds"]      = 0 if final_status == "completed" else None
        _status["history"].append({
            "pct_trigger":      int(trigger_pct),
            "started_at":       _status["started_at"],
            "completed_at":     _status["completed_at"],
            "total_downloaded": prog.get("total_downloaded", 0),
            "result":           final_status,
        })
        _save_status()

    logger.info("[ACTAS] Download thread finished with status=%s", final_status)


# ── Public: notify_pct_change ─────────────────────────────────────────────────

def notify_pct_change(new_pct: float) -> None:
    global _thread, _status, _needs_first_download

    new_int = int(new_pct)

    with _lock:
        current_status   = _status.get("status", "idle")
        last_trigger_int = _status.get("triggered_at_pct")
        first_dl         = _needs_first_download

    if current_status == "downloading" and _thread and _thread.is_alive():
        return

    state_path = ACTAS_DATA_DIR / "download_state.json"
    should_start = False
    resume       = False

    if first_dl:
        should_start = True
        resume       = False

    elif current_status == "interrupted":
        should_start = True
        resume       = state_path.exists() and (last_trigger_int == new_int)

    elif last_trigger_int is None or last_trigger_int != new_int:
        should_start = True
        resume       = False

    if not should_start:
        return

    if not resume and state_path.exists():
        state_path.unlink()
        logger.info("[ACTAS] Cleared stale download state")

    with _lock:
        _needs_first_download            = False
        _status["status"]                = "downloading"
        _status["triggered_at_pct"]      = new_int
        _status["started_at"]            = datetime.now(timezone.utc).isoformat()
        _status["completed_at"]          = None
        if not resume:
            _status["progress"] = _default_status()["progress"]
        _save_status()

    _stop_event.clear()
    _thread = threading.Thread(
        target=_run_download,
        args=(new_pct, resume),
        name="actas-downloader",
        daemon=True,
    )
    _thread.start()

    action = "Resuming" if resume else "Starting fresh"
    logger.info("[ACTAS] %s download (int_pct=%d%%)", action, new_int)


# ── Public: lifecycle ─────────────────────────────────────────────────────────

def start() -> None:
    global _status, _needs_first_download

    _status = _load_status()

    current_status = _status.get("status", "idle")

    if current_status == "downloading":
        with _lock:
            _status["status"] = "interrupted"
            _save_status()
        logger.info("[ACTAS] Found in-progress download at startup — will resume on next tick")

    elif current_status == "idle" and not _status.get("triggered_at_pct"):
        _needs_first_download = True
        logger.info("[ACTAS] No prior download found — will start on first scheduler tick")

    logger.info("[ACTAS] Controller initialized (status=%s)", _status.get("status"))


def stop() -> None:
    global _needs_first_download
    _stop_event.set()
    if _thread and _thread.is_alive():
        logger.info("[ACTAS] Waiting for download thread…")
        _thread.join(timeout=15)
    _needs_first_download = False
    logger.info("[ACTAS] Controller stopped.")

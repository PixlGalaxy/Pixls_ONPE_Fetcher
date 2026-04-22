import logging
import random
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import fetcher
import processor
import storage
import predictor
from AI.rag import rag_engine
from config import (
    DEPARTMENTS,
    ELECTIONS,
    MIN_PCT_CHANGE_TO_SAVE,
    POLL_INTERVAL_SECONDS,
    POLL_JITTER_SECONDS,
    dep_ubigeo,
)

logger = logging.getLogger(__name__)

# ── Internal state ─────────────────────────────────────────────────────────
_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()
_last_known_pct: Optional[float] = None         # presidential actas %
_lock = threading.Lock()                        # protects _last_known_pct
_last_tick_time: Optional[datetime] = None      # when the scheduler last polled ONPE
_last_change_time: Optional[datetime] = None    # when ONPE data last changed
_next_tick_time: Optional[datetime] = None      # when the next poll will happen (with jitter)

def _load_last_known_pct() -> Optional[float]:
    meta = storage.load_metadata()
    return meta.get("elections", {}).get("presidential", {}).get("last_actas_pct")

# ── Core fetch helpers ─────────────────────────────────────────────────────

def _fetch_and_store_national(election_key: str) -> Optional[float]:
    cfg = ELECTIONS[election_key]
    if cfg.get("skip_national"):
        logger.debug(
            "[SCHEDULER] Skipping national fetch for %s (multi-district, no national candidates list).",
            election_key,
        )
        return None
    try:
        raw = fetcher.fetch_national(election_key)
    except Exception as exc:
        logger.error("[SCHEDULER] fetch_national(%s) failed: %s", election_key, exc)
        return None

    snapshot = processor.build_snapshot(
        election_key=election_key,
        election_label=cfg["label"],
        scope="national",
        raw_totales=raw["totales"],
        raw_participantes=raw["participantes"],
    )
    pct = processor.actas_pct(snapshot)

    storage.save_current(election_key, snapshot)

    meta = storage.load_metadata()
    prev_pct = meta.get("elections", {}).get(election_key, {}).get("last_actas_pct")
    if prev_pct is None or abs(pct - prev_pct) >= MIN_PCT_CHANGE_TO_SAVE:
        storage.save_history_snapshot(election_key, snapshot, pct)
        storage.build_and_save_timeline(election_key)
        meta["elections"][election_key]["snapshot_count"] = (
            meta["elections"][election_key].get("snapshot_count", 0) + 1
        )
        logger.info("[SCHEDULER] %s history checkpoint at %.3f%%", election_key, pct)
    else:
        logger.debug("[SCHEDULER] %s pct unchanged (%.3f%%), skipping history.", election_key, pct)

    meta["elections"][election_key]["last_actas_pct"] = pct
    meta["elections"][election_key]["last_snapshot_time"] = snapshot["snapshot_time"]
    storage.save_metadata(meta)

    logger.info("[SCHEDULER] %s current.json updated. actas=%.3f%%", election_key, pct)
    return pct


def _fetch_and_store_regions(election_key: str) -> None:
    cfg = ELECTIONS[election_key]

    # Departments
    for dep_id, dep_name in DEPARTMENTS.items():
        ubigeo = dep_ubigeo(dep_id)
        try:
            raw = fetcher.fetch_geographic(election_key, "region", ubigeo)
        except Exception as exc:
            logger.warning("[SCHEDULER] region %s (%s) failed: %s", dep_name, ubigeo, exc)
            continue

        snapshot = processor.build_snapshot(
            election_key=election_key,
            election_label=cfg["label"],
            scope=f"region:{ubigeo}:{dep_name}",
            raw_totales=raw["totales"],
            raw_participantes=raw["participantes"],
        )
        storage.save_geographic(election_key, "regions", ubigeo, snapshot)
        logger.debug("[SCHEDULER] %s region %s saved.", election_key, dep_name)
        time.sleep(0.3)   # polite pause between requests

    # Abroad
    try:
        raw_abroad = fetcher.fetch_abroad(election_key)
        abroad_snapshot = processor.build_snapshot(
            election_key=election_key,
            election_label=cfg["label"],
            scope="abroad",
            raw_totales=raw_abroad["totales"],
            raw_participantes=raw_abroad["participantes"],
        )
        storage.save_abroad(election_key, abroad_snapshot)
        logger.info("[SCHEDULER] %s abroad saved.", election_key)
    except Exception as exc:
        logger.warning("[SCHEDULER] abroad(%s) failed: %s", election_key, exc)


# ── Prediction helper ──────────────────────────────────────────────────────

def _run_prediction_safe() -> None:
    try:
        predictor.run_prediction()
    except Exception as exc:
        logger.error("[SCHEDULER] Prediction failed: %s", exc, exc_info=True)


# ── Full refresh ──────────────────────────────────────────────────────────

def _full_refresh() -> None:
    logger.info("[SCHEDULER] Starting full refresh…")

    pcts = []
    for election_key in ELECTIONS:
        pct = _fetch_and_store_national(election_key)
        if pct is not None:
            pcts.append(pct)

    _fetch_and_store_regions("presidential")

    threading.Thread(
        target=_run_prediction_safe, name="predictor", daemon=True
    ).start()

    meta = storage.load_metadata()
    meta["last_full_fetch"] = datetime.now(timezone.utc).isoformat()
    storage.save_metadata(meta)

    if pcts:
        logger.info(
            "[SCHEDULER] Full refresh done. presidential actas≈%.3f%%", pcts[0]
        )


# ── Scheduler loop ────────────────────────────────────────────────────────

def _quick_check_presidential_pct() -> Optional[float]:
    try:
        raw = fetcher.fetch_national("presidential")
        totales = raw["totales"]
        return float(totales.get("actasContabilizadas", 0.0))
    except Exception as exc:
        logger.warning("[SCHEDULER] quick check failed: %s", exc)
        return None


def _scheduler_loop() -> None:
    global _last_known_pct, _last_tick_time, _last_change_time, _next_tick_time

    logger.info("[SCHEDULER] Thread started (interval=%ds).", POLL_INTERVAL_SECONDS)

    with _lock:
        if _last_known_pct is None:
            _last_known_pct = _load_last_known_pct()
            if _last_known_pct is not None:
                logger.info(
                    "[SCHEDULER] Restored last_known_pct=%.3f%% from metadata.",
                    _last_known_pct,
                )

    while not _stop_event.is_set():
        try:
            now = datetime.now(timezone.utc)
            with _lock:
                _last_tick_time = now
                if _next_tick_time is None or _next_tick_time <= now:
                    _next_tick_time = now + timedelta(seconds=POLL_INTERVAL_SECONDS)
            current_pct = _quick_check_presidential_pct()
            if current_pct is None:
                logger.warning("[SCHEDULER] Could not read actas %, will retry next tick.")
            else:
                logger.info("[SCHEDULER] Quick check: actas=%.3f%%", current_pct)
                with _lock:
                    prev = _last_known_pct

                changed = (
                    prev is None
                    or abs(current_pct - prev) >= MIN_PCT_CHANGE_TO_SAVE
                )

                if changed:
                    logger.info(
                        "[SCHEDULER] Actas %% changed: %.3f%% -> %.3f%%. Triggering full refresh.",
                        prev or 0.0,
                        current_pct,
                    )
                    _full_refresh()
                    rag_engine.trigger_rebuild()
                    with _lock:
                        _last_known_pct = current_pct
                        _last_change_time = datetime.now(timezone.utc)
                    logger.info("[SCHEDULER] Full refresh done. New pct=%.3f%%", current_pct)
                else:
                    logger.info(
                        "[SCHEDULER] No change (%.3f%%). Skipping refresh.", current_pct
                    )

        except Exception as exc:
            logger.error("[SCHEDULER] Unhandled error in loop: %s", exc, exc_info=True)

        sleep_secs = POLL_INTERVAL_SECONDS + random.randint(-POLL_JITTER_SECONDS, POLL_JITTER_SECONDS)
        sleep_secs = max(sleep_secs, 10)  # never less than 10s
        with _lock:
            _next_tick_time = datetime.now(timezone.utc) + timedelta(seconds=sleep_secs)
        logger.info("[SCHEDULER] Next check in %ds (at %s)", sleep_secs, _next_tick_time.strftime('%H:%M:%S'))
        for _ in range(sleep_secs):
            if _stop_event.is_set():
                break
            time.sleep(1)

    logger.info("[SCHEDULER] Thread exiting.")


# ── Public info API ───────────────────────────────────────────────────────

def get_scheduler_info() -> dict:
    with _lock:
        tick = _last_tick_time
        change = _last_change_time
        next_tick = _next_tick_time

    return {
        "poll_interval_seconds": POLL_INTERVAL_SECONDS,
        "poll_jitter_seconds": POLL_JITTER_SECONDS,
        "last_check_time": tick.isoformat() if tick else None,
        "next_check_time": next_tick.isoformat() if next_tick else None,
        "last_change_detected": change.isoformat() if change else None,
        "is_running": _thread is not None and _thread.is_alive(),
    }


# ── Public lifecycle API ──────────────────────────────────────────────────

def _rebuild_timeline_if_stale() -> None:
    try:
        meta = storage.load_metadata()
        current_pct = meta.get("elections", {}).get("presidential", {}).get("last_actas_pct")
        if current_pct is None:
            return
        timeline = storage._read(storage._election_dir("presidential") / "timeline.json")
        timeline_pct = timeline["cuts"][-1]["actas_pct"] if timeline and timeline.get("cuts") else None
        if timeline_pct is None or abs(current_pct - timeline_pct) >= 0.001:
            logger.info(
                "[TIMELINE] Stale detected (timeline=%.3f%% vs current=%.3f%%). Rebuilding…",
                timeline_pct or 0, current_pct,
            )
            storage.build_and_save_timeline("presidential")
    except Exception as exc:
        logger.error("[TIMELINE] Startup rebuild failed: %s", exc)


def start() -> None:
    global _thread
    if _thread and _thread.is_alive():
        logger.warning("[SCHEDULER] Already running.")
        return
    _stop_event.clear()
    _thread = threading.Thread(target=_scheduler_loop, name="onpe-scheduler", daemon=True)
    _thread.start()
    logger.info("[SCHEDULER] Started.")

    threading.Thread(
        target=_rebuild_timeline_if_stale, name="timeline-startup", daemon=True
    ).start()
    threading.Thread(
        target=_run_prediction_safe, name="predictor-startup", daemon=True
    ).start()


def stop() -> None:
    _stop_event.set()
    if _thread:
        _thread.join(timeout=10)
    fetcher.close_driver()
    logger.info("[SCHEDULER] Stopped.")


def trigger_now() -> None:
    logger.info("[SCHEDULER] Manual refresh triggered.")
    try:
        _full_refresh()
        rag_engine.trigger_rebuild()
        pct = _quick_check_presidential_pct()
        with _lock:
            global _last_known_pct
            _last_known_pct = pct
    except Exception as exc:
        logger.error("[SCHEDULER] Manual refresh failed: %s", exc, exc_info=True)
        raise


def fetch_geographic_on_demand(
    election_key: str,
    filter_type: str,
    ubigeo: str,
) -> dict:
    cfg = ELECTIONS[election_key]
    raw = fetcher.fetch_geographic(election_key, filter_type, ubigeo)
    snapshot = processor.build_snapshot(
        election_key=election_key,
        election_label=cfg["label"],
        scope=f"{filter_type}:{ubigeo}",
        raw_totales=raw["totales"],
        raw_participantes=raw["participantes"],
    )
    storage.save_geographic(election_key, f"{filter_type}s", ubigeo, snapshot)
    return snapshot

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from config import DATA_DIR, ELECTIONS

logger = logging.getLogger(__name__)

# ── Path helpers ──────────────────────────────────────────────────────────

def _election_dir(election_key: str) -> Path:
    return DATA_DIR / election_key


def _history_dir(election_key: str) -> Path:
    return _election_dir(election_key) / "history"


def _geo_dir(election_key: str, filter_type: str) -> Path:
    """filter_type: 'regions' | 'provinces' | 'districts'"""
    return _election_dir(election_key) / "geographic" / filter_type


def _ensure(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


# ── Low-level read/write ──────────────────────────────────────────────────

def _write(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)          # atomic on most OS


def _read(path: Path) -> Optional[Any]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Could not read %s: %s", path, exc)
        return None


# ── Metadata ──────────────────────────────────────────────────────────────

METADATA_PATH = DATA_DIR / "metadata.json"

_DEFAULT_METADATA: dict = {
    "last_full_fetch": None,
    "elections": {
        key: {
            "last_actas_pct": None,
            "last_snapshot_time": None,
            "snapshot_count": 0,
        }
        for key in ELECTIONS
    },

}


def load_metadata() -> dict:
    data = _read(METADATA_PATH)
    if data is None:
        return dict(_DEFAULT_METADATA)
    for key in ELECTIONS:
        data.setdefault("elections", {})
        data["elections"].setdefault(
            key,
            {"last_actas_pct": None, "last_snapshot_time": None, "snapshot_count": 0},
        )
    return data


def save_metadata(meta: dict) -> None:
    _write(METADATA_PATH, meta)


# ── National snapshots ────────────────────────────────────────────────────

def save_current(election_key: str, snapshot: dict) -> None:
    _write(_election_dir(election_key) / "current.json", snapshot)
    logger.info("[STORED] %s/current.json", election_key)


def load_current(election_key: str) -> Optional[dict]:
    return _read(_election_dir(election_key) / "current.json")


def save_history_snapshot(election_key: str, snapshot: dict, actas_pct: float) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"{actas_pct:.3f}_{ts}.json"
    _write(_history_dir(election_key) / filename, snapshot)
    logger.info("[HISTORY] %s/%s", election_key, filename)


def load_history(election_key: str) -> list[dict]:
    hdir = _history_dir(election_key)
    if not hdir.exists():
        return []
    files = sorted(hdir.glob("*.json"))
    result = []
    for f in files:
        data = _read(f)
        if data:
            result.append(data)
    return result


# ── Geographic snapshots ──────────────────────────────────────────────────

def save_geographic(
    election_key: str,
    filter_type: str,
    ubigeo: str,
    snapshot: dict,
) -> None:
    _write(_geo_dir(election_key, filter_type) / f"{ubigeo}.json", snapshot)


def load_geographic(
    election_key: str,
    filter_type: str,
    ubigeo: str,
) -> Optional[dict]:
    return _read(_geo_dir(election_key, filter_type) / f"{ubigeo}.json")


def load_all_geographic(election_key: str, filter_type: str) -> dict[str, dict]:
    gdir = _geo_dir(election_key, filter_type)
    if not gdir.exists():
        return {}
    result = {}
    for f in gdir.glob("*.json"):
        data = _read(f)
        if data:
            result[f.stem] = data
    return result


# ── Abroad ────────────────────────────────────────────────────────────────

def save_abroad(election_key: str, snapshot: dict) -> None:
    _write(_election_dir(election_key) / "geographic" / "abroad.json", snapshot)
    logger.info("[STORED] %s/geographic/abroad.json", election_key)


def load_abroad(election_key: str) -> Optional[dict]:
    return _read(_election_dir(election_key) / "geographic" / "abroad.json")

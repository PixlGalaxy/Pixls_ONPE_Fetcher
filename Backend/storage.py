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
    path = _election_dir(election_key) / "current.json"
    existing = _read(path)
    if existing:
        existing_time = existing.get("snapshot_time", "")
        new_time = snapshot.get("snapshot_time", "")
        if existing_time and new_time and existing_time > new_time:
            logger.warning(
                "[STORED] Skipping stale write for %s (existing=%s > new=%s)",
                election_key, existing_time, new_time,
            )
            return
    _write(path, snapshot)
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


# ── Timeline builder ──────────────────────────────────────────────────────

_ID_TO_KEY: dict[str, str] = {
    "10001088": "fuji",
    "07845838": "rla",
    "06506278": "nieto",
    "09177250": "belm",
    "16002918": "sanch",
}


def build_and_save_timeline(election_key: str) -> None:
    snapshots = load_history(election_key)
    if not snapshots:
        return

    candidate_info: dict[str, dict] = {}
    total_actas = 0
    cuts = []

    for snap in snapshots:
        actas = snap.get("actas", {})
        pct = actas.get("actas_contabilizadas_pct", 0.0)
        contabilizadas = actas.get("actas_contabilizadas", 0)
        jee = actas.get("actas_enviadas_jee", 0) or 0
        votos_emitidos = actas.get("total_votes_cast", 0) or 0
        total_actas = max(total_actas, actas.get("actas_total", 0))

        cand_pcts: dict[str, float] = {}
        for c in snap.get("candidates", []):
            cid = c.get("candidate_id", "")
            key = _ID_TO_KEY.get(cid)
            if not key:
                continue
            cand_pcts[key] = c.get("percentage", 0.0)
            if key not in candidate_info:
                candidate_info[key] = {
                    "candidate_id": cid,
                    "name": c.get("name", ""),
                    "party": c.get("party", ""),
                }

        cuts.append({
            "ts": snap.get("snapshot_time", ""),
            "actas_pct": pct,
            "contabilizadas": contabilizadas,
            "jee": jee,
            "votos_emitidos": votos_emitidos,
            "candidates": cand_pcts,
        })

    cuts.sort(key=lambda c: c["actas_pct"])

    timeline = {
        "description": "Historical evolution of national candidate % per actas cut",
        "total_actas": total_actas,
        "candidate_info": candidate_info,
        "cuts_count": len(cuts),
        "cuts": cuts,
    }

    _write(_election_dir(election_key) / "timeline.json", timeline)
    logger.info("[TIMELINE] Rebuilt %s timeline: %d cuts, last=%.3f%%",
                election_key, len(cuts), cuts[-1]["actas_pct"] if cuts else 0)

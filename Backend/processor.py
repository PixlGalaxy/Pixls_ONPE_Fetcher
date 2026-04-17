from datetime import datetime, timezone
from typing import Any


# ── Candidate normalisation ────────────────────────────────────────────────

def _normalise_candidate(raw: dict, rank: int) -> dict:
    return {
        "rank": rank,
        "candidate_id": str(raw.get("dniCandidato", "")),
        "name": raw.get("nombreCandidato", ""),
        "party": raw.get("nombreAgrupacionPolitica", ""),
        "party_id": raw.get("idAgrupacionPolitica"),
        "votes": int(raw.get("totalVotosValidos", 0)),
        "percentage": float(raw.get("porcentajeVotosValidos", 0.0)),
    }


# ── Totals normalisation ───────────────────────────────────────────────────

def _normalise_totals(raw: dict) -> dict:
    return {
        "actas_contabilizadas_pct": float(raw.get("actasContabilizadas", 0.0)),
        "actas_contabilizadas": int(raw.get("contabilizadas", 0)),
        "actas_total": int(raw.get("totalActas", 0)),
        "actas_pendientes": int(raw.get("totalActas", 0)) - int(raw.get("contabilizadas", 0)),
        "actas_enviadas_jee": int(raw.get("enviadasJee", 0)),
        "actas_pendientes_jee": int(raw.get("pendientesJee", 0)),
        "total_votes_cast": int(raw.get("totalVotosEmitidos", 0)),
        "total_valid_votes": int(raw.get("totalVotosValidos", 0)),
        "citizen_participation_pct": float(raw.get("participacionCiudadana", 0.0)),
    }


# ── Full snapshot builder ──────────────────────────────────────────────────

def build_snapshot(
    election_key: str,
    election_label: str,
    scope: str,           # "national" | "region:{ubigeo}" | "province:{ubigeo}" | ...
    raw_totales: dict,
    raw_participantes: list,
) -> dict:
    sorted_cands = sorted(
        raw_participantes,
        key=lambda c: c.get("totalVotosValidos", 0),
        reverse=True,
    )

    return {
        "election": election_key,
        "label": election_label,
        "scope": scope,
        "snapshot_time": datetime.now(timezone.utc).isoformat(),
        "actas": _normalise_totals(raw_totales),
        "candidates": [
            _normalise_candidate(c, rank)
            for rank, c in enumerate(sorted_cands, start=1)
        ],
    }


# ── Convenience: extract actas % from a snapshot ──────────────────────────

def actas_pct(snapshot: dict) -> float:
    return snapshot.get("actas", {}).get("actas_contabilizadas_pct", 0.0)

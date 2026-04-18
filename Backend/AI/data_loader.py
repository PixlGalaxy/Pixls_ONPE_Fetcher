import json
from pathlib import Path
from typing import Optional

LOADER_VERSION = "1"

DATA_DIR = Path(__file__).parent.parent / "data"

UBIGEO_TO_DEP: dict[str, str] = {
    "010000": "Amazonas",   "020000": "Áncash",      "030000": "Apurímac",
    "040000": "Arequipa",   "050000": "Ayacucho",    "060000": "Cajamarca",
    "070000": "Callao",     "080000": "Cusco",       "090000": "Huancavelica",
    "100000": "Huánuco",    "110000": "Ica",         "120000": "Junín",
    "130000": "La Libertad","140000": "Lambayeque",  "150000": "Lima",
    "160000": "Loreto",     "170000": "Madre de Dios","180000": "Moquegua",
    "190000": "Pasco",      "200000": "Piura",       "210000": "Puno",
    "220000": "San Martín", "230000": "Tacna",       "240000": "Tumbes",
    "250000": "Ucayali",
}


def _read(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _title(name: str) -> str:
    return name.strip().title() if name else "Desconocido"


def _resolve_name(candidate: dict) -> str:
    return _title(candidate.get("name", "Desconocido"))


def _resolve_party(candidate: dict) -> str:
    return candidate.get("party", "").strip()


def _candidates_detail(candidates: list[dict], limit: int = 10) -> str:
    lines = []
    for c in candidates[:limit]:
        name = _resolve_name(c)
        party = _resolve_party(c)
        votes = c.get("votes") or 0
        pct = c.get("percentage", 0)
        rank = c.get("rank", "?")
        party_str = f" [{party}]" if party else ""
        lines.append(f"  {rank}. {name}{party_str}: {votes:,} votos ({pct:.3f}%)")
    return "\n".join(lines)


def _candidates_short(candidates: list[dict], limit: int = 5) -> str:
    parts = []
    for c in candidates[:limit]:
        name = _resolve_name(c)
        pct = c.get("percentage", 0)
        parts.append(f"{name} {pct:.2f}%")
    return " | ".join(parts)


def _actas_info(actas: dict) -> str:
    pct = actas.get("actas_contabilizadas_pct", 0)
    cont = actas.get("actas_contabilizadas", 0)
    total = actas.get("actas_total", 0)
    return f"{pct:.2f}% ({cont:,}/{total:,} actas)"


# ── Loaders ────────────────────────────────────────────────────────────────

_RANK_LABELS = {1: "PRIMER LUGAR", 2: "SEGUNDO LUGAR", 3: "TERCER LUGAR",
               4: "CUARTO LUGAR", 5: "QUINTO LUGAR"}


def _candidates_detail_ranked(candidates: list[dict], limit: int = 15) -> str:
    lines = []
    for c in candidates[:limit]:
        name = _resolve_name(c)
        party = _resolve_party(c)
        votes = c.get("votes") or 0
        pct = c.get("percentage", 0)
        rank = c.get("rank", 0)
        label = _RANK_LABELS.get(rank, f"PUESTO {rank}")
        party_str = f" [{party}]" if party else ""
        lines.append(f"  {rank}. {name}{party_str}: {votes:,} votos ({pct:.3f}%) — {label} NACIONAL")
    return "\n".join(lines)


def _chunk_presidential_current() -> list[dict]:
    data = _read(DATA_DIR / "presidential" / "current.json")
    if not data:
        return []
    actas = data.get("actas", {})
    time_ = data.get("snapshot_time", "desconocido")
    candidates = data.get("candidates", [])

    top5_summary = " > ".join(
        f"{_resolve_name(c)} ({c.get('percentage',0):.2f}%)"
        for c in candidates[:5]
    )

    text = (
        f"[FUENTE AUTORITATIVA] RANKING NACIONAL PRESIDENCIAL OFICIAL\n"
        f"ADVERTENCIA: Este ranking nacional prevalece sobre cualquier dato regional.\n"
        f"Actas: {_actas_info(actas)} | Actualizado: {time_}\n"
        f"Orden nacional: {top5_summary}\n"
        f"Detalle completo:\n"
        + _candidates_detail_ranked(candidates, limit=15)
    )
    return [{"text": text, "source": "presidential_current"}]


def _chunk_prediction() -> list[dict]:
    pred = _read(DATA_DIR / "presidential" / "prediction.json")
    if not pred:
        return []
    sim = pred.get("simulation", {})
    meta = sim.get("meta", {})
    nat_pct = pred.get("national_actas_pct", 0)
    pred_time = pred.get("prediction_time", "")
    n_sim = meta.get("n_simulations", 0)
    unc = meta.get("uncertainty_factor", 0) * 100

    lines = [
        f"PREDICCIÓN MONTE CARLO PRESIDENCIAL",
        f"Simulaciones: {n_sim:,} | Actas base: {nat_pct:.2f}% | Incertidumbre: {unc:.1f}% | Generada: {pred_time}",
        "Proyección al 100% de actas:",
    ]
    cands = sim.get("candidates", {})
    sorted_cands = sorted(cands.values(), key=lambda x: x.get("predicted_pct", 0), reverse=True)
    for i, c in enumerate(sorted_cands[:10], 1):
        name = _resolve_name(c)
        p_votes = c.get("predicted_votes", 0)
        p_pct = c.get("predicted_pct", 0)
        curr_pct = c.get("current_pct", 0)
        ci = c.get("confidence_interval", {})
        p5, p95 = ci.get("p5_pct", 0), ci.get("p95_pct", 0)
        mom = c.get("trend", {}).get("momentum", 0)
        diff = p_pct - curr_pct
        rank_probs = c.get("rank_probabilities", {})
        rank_prob_str = ", ".join(
            f"P(#{k})={v*100:.1f}%"
            for k, v in sorted(rank_probs.items(), key=lambda x: int(x[0]))
            if v > 0.001
        )
        lines.append(
            f"  {i}. {name}: {p_pct:.3f}% ({p_votes:,} votos est.) "
            f"[actual {curr_pct:.3f}%, diff {diff:+.3f}%] "
            f"IC90%: [{p5:.3f}%–{p95:.3f}%], momentum: {mom:+.4f}"
            + (f" | Prob.posición: {rank_prob_str}" if rank_prob_str else "")
        )

    rank_changes = sim.get("rank_changes", [])
    if rank_changes:
        lines.append("\nPROBABILIDAD DE CAMBIO DE POSICIÓN:")
        for rc in rank_changes[:8]:
            chall = rc.get("challenger", {})
            defend = rc.get("defender", {})
            prob = rc.get("overtake_probability", 0) * 100
            cn = chall.get("name", "?").split()[-1]
            dn = defend.get("name", "?").split()[-1]
            lines.append(
                f"  {cn} (#{chall.get('current_rank','?')}) supere a "
                f"{dn} (#{defend.get('current_rank','?')}): {prob:.1f}%"
            )

    return [{"text": "\n".join(lines), "source": "prediction"}]


def _chunk_history() -> list[dict]:
    hist_dir = DATA_DIR / "presidential" / "history"
    if not hist_dir.exists():
        return []
    chunks = []
    hist_files = sorted(hist_dir.glob("*.json"))[-8:]
    for f in hist_files:
        snap = _read(f)
        if not snap:
            continue
        actas = snap.get("actas", {})
        pct = actas.get("actas_contabilizadas_pct", 0)
        time_ = snap.get("snapshot_time", f.stem)
        top5 = snap.get("candidates", [])[:5]
        ranking = "; ".join(
            f"{_resolve_name(c)}: {c.get('percentage',0):.3f}%"
            for c in top5
        )
        text = f"HISTORIAL PRESIDENCIAL | Actas: {pct:.2f}% | {time_}\nTop 5: {ranking}"
        chunks.append({"text": text, "source": f"history_{f.stem}"})
    return chunks


def _chunk_regions() -> list[dict]:
    regions_dir = DATA_DIR / "presidential" / "geographic" / "regions"
    if not regions_dir.exists():
        return []

    chunks = []
    region_files = sorted(regions_dir.glob("*.json"))

    for f in region_files:
        snap = _read(f)
        if not snap:
            continue
        scope = snap.get("scope", f.stem)
        region_name = scope.split(":")[-1].strip() if ":" in scope else scope
        ubigeo = f.stem
        actas = snap.get("actas", {})
        time_ = snap.get("snapshot_time", "")
        candidates = snap.get("candidates", [])

        text = (
            f"DEPARTAMENTO: {region_name.upper()} (ubigeo {ubigeo})\n"
            f"Actas: {_actas_info(actas)} | Actualizado: {time_}\n"
            f"Resultados presidenciales en {region_name}:\n"
            + _candidates_detail(candidates, limit=10)
        )
        chunks.append({"text": text, "source": f"region_{ubigeo}"})

    nat = _read(DATA_DIR / "presidential" / "current.json")
    nat_top3 = ""
    if nat:
        top3 = nat.get("candidates", [])[:3]
        nat_top3 = " | ".join(
            f"{_resolve_name(c)}: {c.get('percentage',0):.2f}%"
            for c in top3
        )

    summary_lines = [
        "RESUMEN PRESIDENCIAL POR DEPARTAMENTO:",
        f"[RECORDATORIO RANKING NACIONAL: {nat_top3}]",
        "Nota: los porcentajes siguientes son LOCALES (un candidato puede liderar en una región y ser 4to o 5to nacionalmente)",
    ]
    winners: dict[str, list[str]] = {}

    for f in region_files:
        snap = _read(f)
        if not snap:
            continue
        scope = snap.get("scope", f.stem)
        region_name = scope.split(":")[-1].strip() if ":" in scope else scope
        actas_pct = snap.get("actas", {}).get("actas_contabilizadas_pct", 0)
        cands = snap.get("candidates", [])
        short = _candidates_short(cands, limit=3)
        summary_lines.append(f"  {region_name}: {actas_pct:.1f}% actas → {short}")

        if cands:
            winner_name = _resolve_name(cands[0])
            winners.setdefault(winner_name, []).append(region_name)

    if winners:
        summary_lines.append("\nCandidato que va primero por departamento:")
        for cand, deps in sorted(winners.items(), key=lambda x: len(x[1]), reverse=True):
            summary_lines.append(f"  {cand}: lidera en {', '.join(sorted(deps))}")

    chunks.append({"text": "\n".join(summary_lines), "source": "regions_overview"})
    return chunks


def _chunk_provinces() -> list[dict]:
    prov_dir = DATA_DIR / "presidential" / "geographic" / "provinces"
    if not prov_dir.exists():
        return []

    chunks = []
    province_files = sorted(prov_dir.glob("*.json"))
    if not province_files:
        return []

    for f in province_files:
        snap = _read(f)
        if not snap:
            continue
        scope = snap.get("scope", f.stem)
        prov_name = scope.split(":")[-1].strip() if ":" in scope else scope
        ubigeo = f.stem
        dep_ubigeo = ubigeo[:2] + "0000"
        dep_name = UBIGEO_TO_DEP.get(dep_ubigeo, "")
        dep_str = f" (Departamento: {dep_name})" if dep_name else ""
        actas = snap.get("actas", {})
        candidates = snap.get("candidates", [])

        text = (
            f"PROVINCIA: {prov_name.upper()}{dep_str} (ubigeo {ubigeo})\n"
            f"Actas: {_actas_info(actas)}\n"
            f"Resultados presidenciales en {prov_name}:\n"
            + _candidates_detail(candidates, limit=10)
        )
        chunks.append({"text": text, "source": f"province_{ubigeo}"})

    by_dep: dict[str, list[str]] = {}
    for f in province_files:
        snap = _read(f)
        if not snap:
            continue
        ubigeo = f.stem
        dep_ubigeo = ubigeo[:2] + "0000"
        dep_name = UBIGEO_TO_DEP.get(dep_ubigeo, dep_ubigeo)
        scope = snap.get("scope", f.stem)
        prov_name = scope.split(":")[-1].strip() if ":" in scope else f.stem
        actas_pct = snap.get("actas", {}).get("actas_contabilizadas_pct", 0)
        cands = snap.get("candidates", [])
        short = _candidates_short(cands, limit=2)
        by_dep.setdefault(dep_name, []).append(f"    {prov_name} ({actas_pct:.1f}%): {short}")

    if by_dep:
        prov_summary = ["RESUMEN PRESIDENCIAL POR PROVINCIA:"]
        for dep, lines in sorted(by_dep.items()):
            prov_summary.append(f"  {dep}:")
            prov_summary.extend(lines)
        chunks.append({"text": "\n".join(prov_summary), "source": "provinces_overview"})

    return chunks


def _chunk_senate() -> list[dict]:
    data = _read(DATA_DIR / "senate_national" / "current.json")
    if not data:
        return []
    actas = data.get("actas", {})
    time_ = data.get("snapshot_time", "")
    text = (
        f"SENADO NACIONAL\n"
        f"Actas: {_actas_info(actas)} | Actualizado: {time_}\n"
        + _candidates_detail(data.get("candidates", []), limit=15)
    )
    return [{"text": text, "source": "senate_national_current"}]


def _chunk_parlamento_andino() -> list[dict]:
    data = _read(DATA_DIR / "parlamento_andino" / "current.json")
    if not data:
        return []
    actas = data.get("actas", {})
    time_ = data.get("snapshot_time", "")
    text = (
        f"PARLAMENTO ANDINO\n"
        f"Actas: {_actas_info(actas)} | Actualizado: {time_}\n"
        + _candidates_detail(data.get("candidates", []), limit=15)
    )
    return [{"text": text, "source": "parlamento_andino_current"}]


# ── Entry point ────────────────────────────────────────────────────────────

def load_chunks() -> list[dict]:
    chunks: list[dict] = []
    chunks.extend(_chunk_presidential_current())
    chunks.extend(_chunk_prediction())
    chunks.extend(_chunk_history())
    chunks.extend(_chunk_regions())
    chunks.extend(_chunk_provinces())
    chunks.extend(_chunk_senate())
    chunks.extend(_chunk_parlamento_andino())
    return chunks

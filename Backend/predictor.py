import json
import logging
import math
import random
from pathlib import Path
from typing import Optional

import storage
from config import DATA_DIR, DEPARTMENTS, dep_ubigeo

logger = logging.getLogger(__name__)

N_SIMULATIONS = 100_000  
PREDICTION_PATH = DATA_DIR / "presidential" / "prediction.json"


# ─── Helpers ───────────────────────────────────────────────────────────────

def _safe_div(a: float, b: float) -> float:
    return a / b if b else 0.0


# ─── Data collection ──────────────────────────────────────────────────────

def _load_region_data() -> list[dict]:
    regions = []
    for dep_id, dep_name in DEPARTMENTS.items():
        ubigeo = dep_ubigeo(dep_id)
        snap = storage.load_geographic("presidential", "regions", ubigeo)
        if not snap:
            continue
        actas = snap.get("actas", {})
        regions.append({
            "ubigeo": ubigeo,
            "name": dep_name,
            "actas_pct": actas.get("actas_contabilizadas_pct", 0),
            "actas_counted": actas.get("actas_contabilizadas", 0),
            "actas_total": actas.get("actas_total", 0),
            "total_valid_votes": actas.get("total_valid_votes", 0),
            "total_votes_cast": actas.get("total_votes_cast", 0),
            "candidates": [
                {
                    "id": c.get("candidate_id", ""),
                    "name": c.get("name", ""),
                    "party": c.get("party", ""),
                    "votes": c.get("votes", 0) or 0,
                    "pct": c.get("percentage", 0),
                }
                for c in snap.get("candidates", [])
            ],
        })

    # Abroad
    abroad = storage.load_abroad("presidential")
    if abroad:
        actas = abroad.get("actas", {})
        regions.append({
            "ubigeo": "abroad",
            "name": "EXTRANJERO",
            "actas_pct": actas.get("actas_contabilizadas_pct", 0),
            "actas_counted": actas.get("actas_contabilizadas", 0),
            "actas_total": actas.get("actas_total", 0),
            "total_valid_votes": actas.get("total_valid_votes", 0),
            "total_votes_cast": actas.get("total_votes_cast", 0),
            "candidates": [
                {
                    "id": c.get("candidate_id", ""),
                    "name": c.get("name", ""),
                    "party": c.get("party", ""),
                    "votes": c.get("votes", 0) or 0,
                    "pct": c.get("percentage", 0),
                }
                for c in abroad.get("candidates", [])
            ],
        })
    return regions


def _load_national_current() -> Optional[dict]:
    return storage.load_current("presidential")


def _load_history_trend() -> list[dict]:
    snapshots = storage.load_history("presidential")
    result = []
    for s in snapshots:
        actas = s.get("actas", {})
        pct = actas.get("actas_contabilizadas_pct", 0)
        cands = {}
        for c in s.get("candidates", []):
            cid = c.get("candidate_id", "")
            if cid:
                cands[cid] = c.get("percentage", 0)
        result.append({"actas_pct": pct, "candidates": cands})
    result.sort(key=lambda x: x["actas_pct"])
    return result


# ─── Trend analysis ──────────────────────────────────────────────────────

def _compute_trend(history: list[dict], candidate_id: str) -> dict:
    points = []
    for h in history:
        p = h["candidates"].get(candidate_id)
        if p is not None:
            points.append((h["actas_pct"], p))

    if len(points) < 2:
        return {"slope": 0.0, "volatility": 0.05, "last_delta": 0.0, "momentum": 0.0}

    n = len(points)
    sx = sum(p[0] for p in points)
    sy = sum(p[1] for p in points)
    sxx = sum(p[0] ** 2 for p in points)
    sxy = sum(p[0] * p[1] for p in points)
    denom = n * sxx - sx * sx
    slope = (n * sxy - sx * sy) / denom if denom else 0.0

    deltas = []
    for i in range(1, len(points)):
        actas_diff = points[i][0] - points[i - 1][0]
        if actas_diff > 0:
            deltas.append((points[i][1] - points[i - 1][1]) / actas_diff)

    volatility = 0.05
    if deltas:
        mean_d = sum(deltas) / len(deltas)
        variance = sum((d - mean_d) ** 2 for d in deltas) / len(deltas)
        volatility = max(math.sqrt(variance), 0.01)

    last_delta = deltas[-1] if deltas else 0.0

    momentum = 0.0
    if deltas:
        weight_sum = 0.0
        val_sum = 0.0
        for i, d in enumerate(deltas):
            w = math.exp(0.5 * i)  # more weight to recent
            val_sum += w * d
            weight_sum += w
        momentum = val_sum / weight_sum if weight_sum else 0.0

    return {
        "slope": slope,
        "volatility": volatility,
        "last_delta": last_delta,
        "momentum": momentum,
    }


# ─── Regional extrapolation ──────────────────────────────────────────────

def _extrapolate_region(region: dict) -> dict:
    actas_pct = region["actas_pct"]
    actas_total = region["actas_total"]
    actas_counted = region["actas_counted"]
    total_valid = region["total_valid_votes"] or 0
    total_cast = region["total_votes_cast"] or 0

    if actas_pct <= 0 or actas_total <= 0:
        return {}

    votes_per_acta = _safe_div(total_valid, actas_counted) if actas_counted > 0 else 0
    remaining_actas = actas_total - actas_counted
    estimated_remaining_votes = votes_per_acta * remaining_actas
    estimated_total_valid = total_valid + estimated_remaining_votes

    result = {}
    for c in region["candidates"]:
        cid = c["id"] or c["party"]  
        current_votes = c["votes"]
        current_share = c["pct"] / 100.0 if c["pct"] else 0

        estimated_remaining = estimated_remaining_votes * current_share
        result[cid] = current_votes + estimated_remaining

    return result


# ─── Monte Carlo simulation ──────────────────────────────────────────────

def _run_simulations(
    national: dict,
    regions: list[dict],
    history_trend: list[dict],
    n_sims: int = N_SIMULATIONS,
) -> dict:

    nat_actas = national.get("actas", {})
    nat_actas_pct = nat_actas.get("actas_contabilizadas_pct", 0)
    nat_candidates = national.get("candidates", [])

    if not nat_candidates or nat_actas_pct <= 0:
        return {}

    cand_ids = []
    cand_info = {}
    for c in nat_candidates:
        cid = c["candidate_id"]
        if cid:
            cand_ids.append(cid)
            cand_info[cid] = {
                "name": c["name"],
                "party": c["party"],
                "current_votes": c.get("votes", 0) or 0,
                "current_pct": c["percentage"],
            }

    if not cand_ids:
        return {}

    trends = {}
    for cid in cand_ids:
        trends[cid] = _compute_trend(history_trend, cid)

    region_estimates = []
    for r in regions:
        if r.get("ubigeo") == "abroad":
            continue
        ext = _extrapolate_region(r)
        if ext:
            region_estimates.append({
                "name": r["name"],
                "actas_pct": r["actas_pct"],
                "actas_remaining_pct": 100.0 - r["actas_pct"],
                "actas_remaining": max(0, r["actas_total"] - r["actas_counted"]),
                "estimates": ext,
            })

    total_remaining_weight = sum(
        r["actas_remaining_pct"] for r in region_estimates
    )

    nat_total_valid = nat_actas.get("total_valid_votes", 0) or 0
    nat_actas_counted = nat_actas.get("actas_contabilizadas", 0)
    nat_actas_total = nat_actas.get("actas_total", 0)
    votes_per_acta = _safe_div(nat_total_valid, nat_actas_counted)
    nat_remaining = nat_actas_total - nat_actas_counted
    nat_est_total = nat_total_valid + votes_per_acta * nat_remaining

    baseline = {}
    for cid in cand_ids:
        total = sum(
            r["estimates"].get(cid, 0) for r in region_estimates
        )
        baseline[cid] = total

    baseline_total = sum(baseline.values())
    if baseline_total > 0:
        scale = nat_est_total / baseline_total
        for cid in cand_ids:
            baseline[cid] *= scale

    remaining_fraction = max(0.001, (100.0 - nat_actas_pct) / 100.0)
    base_uncertainty = remaining_fraction

    total_remaining_actas = sum(r.get("actas_remaining", 0) for r in region_estimates)
    regional_variance = {}
    for cid in cand_ids:
        pcts = []
        weights = []
        for r in region_estimates:
            remaining = r.get("actas_remaining", 0)
            if remaining <= 0:
                continue
            est = r["estimates"].get(cid, 0)
            r_total = sum(r["estimates"].values())
            if r_total > 0:
                pcts.append(est / r_total * 100.0)
                weights.append(remaining)
        if len(pcts) >= 2 and sum(weights) > 0:
            w_total = sum(weights)
            w_mean = sum(p * w for p, w in zip(pcts, weights)) / w_total
            w_var = sum(w * (p - w_mean) ** 2 for p, w in zip(pcts, weights)) / w_total
            regional_variance[cid] = math.sqrt(w_var) * base_uncertainty
        else:
            regional_variance[cid] = 0.5 * base_uncertainty

    # ── Run simulations ──
    sim_votes = {cid: [] for cid in cand_ids}
    sim_ranks = {cid: [] for cid in cand_ids}

    for _ in range(n_sims):
        votes_this_sim = {}
        for cid in cand_ids:
            trend = trends[cid]
            base = baseline.get(cid, 0)

            regional_sigma = regional_variance.get(cid, 0.5 * remaining_fraction)
          
            hist_sigma = trend["volatility"] * base_uncertainty * 4.0

            combined_sigma = math.sqrt(regional_sigma ** 2 + hist_sigma ** 2)
      
            combined_sigma = max(combined_sigma, 0.3 * base_uncertainty)

            noise_pct_points = random.gauss(0, combined_sigma)

            momentum_bias = trend["momentum"] * remaining_fraction * 2.0

            shift_votes = (noise_pct_points + momentum_bias) * nat_est_total / 100.0
            estimated = base + shift_votes
            estimated = max(0, estimated)

            votes_this_sim[cid] = estimated

        sim_total = sum(votes_this_sim.values())
        if sim_total > 0:
            norm = nat_est_total / sim_total
            for cid in cand_ids:
                votes_this_sim[cid] *= norm

        for cid in cand_ids:
            sim_votes[cid].append(votes_this_sim[cid])

        sorted_cids = sorted(cand_ids, key=lambda x: votes_this_sim[x], reverse=True)
        for rank_idx, cid in enumerate(sorted_cids):
            sim_ranks[cid].append(rank_idx + 1)

    # ── Aggregate results ──
    results = {}
    for cid in cand_ids:
        votes = sim_votes[cid]
        ranks = sim_ranks[cid]
        n = len(votes)

        mean_votes = sum(votes) / n
        mean_pct = _safe_div(mean_votes, nat_est_total) * 100

        sorted_votes = sorted(votes)
        p5 = sorted_votes[int(n * 0.05)]
        p25 = sorted_votes[int(n * 0.25)]
        p50 = sorted_votes[int(n * 0.50)]
        p75 = sorted_votes[int(n * 0.75)]
        p95 = sorted_votes[int(n * 0.95)]

        rank_dist = {}
        for r in ranks:
            rank_dist[r] = rank_dist.get(r, 0) + 1
        rank_probs = {k: v / n for k, v in sorted(rank_dist.items())}

        results[cid] = {
            "candidate_id": cid,
            "name": cand_info[cid]["name"],
            "party": cand_info[cid]["party"],
            "current_votes": cand_info[cid]["current_votes"],
            "current_pct": cand_info[cid]["current_pct"],
            "predicted_votes": round(mean_votes),
            "predicted_pct": round(mean_pct, 3),
            "confidence_interval": {
                "p5_votes": round(p5),
                "p25_votes": round(p25),
                "p50_votes": round(p50),
                "p75_votes": round(p75),
                "p95_votes": round(p95),
                "p5_pct": round(_safe_div(p5, nat_est_total) * 100, 3),
                "p95_pct": round(_safe_div(p95, nat_est_total) * 100, 3),
            },
            "rank_probabilities": {
                str(k): round(v, 4) for k, v in rank_probs.items()
            },
            "trend": {
                "slope": round(trends[cid]["slope"], 6),
                "momentum": round(trends[cid]["momentum"], 6),
                "volatility": round(trends[cid]["volatility"], 6),
            },
        }

    current_ranking = sorted(cand_ids, key=lambda x: cand_info[x]["current_pct"], reverse=True)

    rank_changes = []
    for i in range(1, min(5, len(current_ranking))):
        higher = current_ranking[i - 1]
        lower = current_ranking[i]
        overtake_count = sum(
            1 for s in range(n_sims)
            if sim_votes[lower][s] > sim_votes[higher][s]
        )
        rank_changes.append({
            "challenger": {
                "id": lower,
                "name": cand_info[lower]["name"],
                "current_rank": i + 1,
            },
            "defender": {
                "id": higher,
                "name": cand_info[higher]["name"],
                "current_rank": i,
            },
            "overtake_probability": round(overtake_count / n_sims, 4),
        })

    return {
        "candidates": results,
        "rank_changes": rank_changes,
        "current_ranking": [
            {"rank": i + 1, "id": cid, "name": cand_info[cid]["name"]}
            for i, cid in enumerate(current_ranking)
        ],
        "meta": {
            "n_simulations": n_sims,
            "national_actas_pct": nat_actas_pct,
            "estimated_total_valid_votes": round(nat_est_total),
            "uncertainty_factor": round(base_uncertainty, 4),
            "regions_used": len(region_estimates),
        },
    }


# ─── Regional predictions ────────────────────────────────────────────────

def _build_regional_predictions(regions: list[dict], cand_info: dict) -> list[dict]:
    predictions = []
    for r in regions:
        ext = _extrapolate_region(r)
        if not ext:
            continue
        total = sum(ext.values())
        cands = []
        for key, votes in sorted(ext.items(), key=lambda x: -x[1]):
            info = cand_info.get(key, {})
            cands.append({
                "id": key,
                "name": info.get("name", key),
                "party": info.get("party", ""),
                "predicted_votes": round(votes),
                "predicted_pct": round(_safe_div(votes, total) * 100, 3),
            })
        predictions.append({
            "ubigeo": r["ubigeo"],
            "name": r["name"],
            "actas_pct": r["actas_pct"],
            "candidates": cands[:5],  # top 5
        })
    return predictions


# ─── Main entry point ────────────────────────────────────────────────────

def run_prediction() -> Optional[dict]:
    logger.info("[PREDICTOR] Starting prediction run…")

    national = _load_national_current()
    if not national:
        logger.warning("[PREDICTOR] No national data available. Skipping.")
        return None

    regions = _load_region_data()
    if not regions:
        logger.warning("[PREDICTOR] No regional data available. Skipping.")
        return None

    history = _load_history_trend()
    logger.info(
        "[PREDICTOR] Data loaded: %d regions, %d history snapshots.",
        len(regions), len(history),
    )

    cand_info = {}
    party_to_id: dict[str, str] = {}
    for c in national.get("candidates", []):
        cid = c.get("candidate_id", "")
        if cid:
            cand_info[cid] = {
                "name": c["name"],
                "party": c["party"],
                "current_votes": c.get("votes", 0) or 0,
                "current_pct": c.get("percentage", 0),
            }
            if c.get("party"):
                party_to_id[c["party"]] = cid

    for r in regions:
        if r["ubigeo"] != "abroad":
            continue
        for cand in r["candidates"]:
            if not cand["id"] and cand["party"]:
                matched_id = party_to_id.get(cand["party"], "")
                if matched_id:
                    cand["id"] = matched_id
                    cand["name"] = cand_info[matched_id]["name"]

    sim_results = _run_simulations(national, regions, history)
    if not sim_results:
        logger.warning("[PREDICTOR] Simulation returned no results.")
        return None
    
    regional = _build_regional_predictions(regions, cand_info)

    from datetime import datetime, timezone
    prediction = {
        "prediction_time": datetime.now(timezone.utc).isoformat(),
        "national_actas_pct": national.get("actas", {}).get("actas_contabilizadas_pct", 0),
        "simulation": sim_results,
        "regional_predictions": regional,
    }

    storage._write(PREDICTION_PATH, prediction)
    logger.info("[PREDICTOR] Prediction saved to %s", PREDICTION_PATH)
    return prediction

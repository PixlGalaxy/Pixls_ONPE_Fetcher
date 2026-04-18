import json
import logging
import math
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

STORE_PATH = Path(__file__).parent.parent / "data" / "ai" / "vectorstore.json"


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


class VectorStore:
    def __init__(self) -> None:
        self.texts: list[str] = []
        self.metadatas: list[dict] = []
        self.embeddings: list[list[float]] = []
        self.data_timestamp: Optional[str] = None

    def add_all(
        self,
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        self.texts = texts
        self.embeddings = embeddings
        self.metadatas = metadatas

    def search(self, query_embedding: list[float], k: int = 6,
               exclude_sources: set[str] | None = None) -> list[dict]:
        if not self.embeddings:
            return []
        exclude_sources = exclude_sources or set()
        scores = [
            (i, _cosine(query_embedding, emb))
            for i, emb in enumerate(self.embeddings)
            if self.metadatas[i].get("source") not in exclude_sources
        ]
        scores.sort(key=lambda x: x[1], reverse=True)
        return [
            {
                "text": self.texts[i],
                "score": round(score, 4),
                "metadata": self.metadatas[i],
            }
            for i, score in scores[:k]
        ]

    def get_by_sources(self, sources: list[str]) -> list[dict]:
        result = []
        for i, meta in enumerate(self.metadatas):
            if meta.get("source") in sources:
                result.append({
                    "text": self.texts[i],
                    "score": 1.0,
                    "metadata": meta,
                })
        return result

    def save(self, timestamp: str) -> None:
        STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "timestamp": timestamp,
            "texts": self.texts,
            "metadatas": self.metadatas,
            "embeddings": self.embeddings,
        }
        tmp = STORE_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        tmp.replace(STORE_PATH)
        logger.info("[VECTORSTORE] Saved: %d chunks (ts=%s)", len(self.texts), timestamp)

    def load(self) -> Optional[str]:
        if not STORE_PATH.exists():
            return None
        try:
            data = json.loads(STORE_PATH.read_text(encoding="utf-8"))
            self.texts = data["texts"]
            self.metadatas = data["metadatas"]
            self.embeddings = data["embeddings"]
            self.data_timestamp = data.get("timestamp")
            logger.info("[VECTORSTORE] Loaded: %d chunks", len(self.texts))
            return self.data_timestamp
        except Exception as exc:
            logger.warning("[VECTORSTORE] Error loading: %s", exc)
            return None

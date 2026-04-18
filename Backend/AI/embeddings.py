import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL: str = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")


async def embed_text(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": EMBED_MODEL, "prompt": text, "keep_alive": 0},
        )
        r.raise_for_status()
        return r.json()["embedding"]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    results: list[list[float]] = []
    for i, text in enumerate(texts):
        logger.info("[EMBED] Chunk %d/%d", i + 1, len(texts))
        emb = await embed_text(text)
        results.append(emb)
    return results

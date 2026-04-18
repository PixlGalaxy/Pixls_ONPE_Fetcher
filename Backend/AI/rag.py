import asyncio
import json
import logging
from pathlib import Path
from typing import Optional

from AI.data_loader import load_chunks, LOADER_VERSION
from AI.embeddings import embed_text, embed_texts
from AI.vectorstore import VectorStore

logger = logging.getLogger(__name__)

_METADATA_PATH = Path(__file__).parent.parent / "data" / "metadata.json"


def _get_data_timestamp() -> str:
    if not _METADATA_PATH.exists():
        return "unknown"
    try:
        data = json.loads(_METADATA_PATH.read_text(encoding="utf-8"))
        return data.get("last_full_fetch") or "unknown"
    except Exception:
        return "unknown"


class RAGEngine:
    def __init__(self) -> None:
        self.store = VectorStore()
        self._lock = asyncio.Lock()
        self._ready = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    async def initialize(self) -> None:
        self._loop = asyncio.get_running_loop()
        async with self._lock:
            if self._ready:
                return
            await self._rebuild_if_needed()
            self._ready = True

    def trigger_rebuild(self) -> None:
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self._force_rebuild(), self._loop)
            logger.info("[RAG] Rebuild scheduled from scheduler thread")
        else:
            self._ready = False
            logger.info("[RAG] Loop unavailable, rebuild deferred to next chat")

    async def _force_rebuild(self) -> None:
        async with self._lock:
            self._ready = False
            await self._rebuild_if_needed()
            self._ready = True

    async def _rebuild_if_needed(self) -> None:
        current_ts = f"{_get_data_timestamp()}|v{LOADER_VERSION}"
        stored_ts = self.store.load()

        if stored_ts == current_ts and self.store.texts:
            logger.info("[RAG] Vectorstore current (ts=%s), skipping rebuild", current_ts)
            return

        logger.info("[RAG] Building vectorstore (ts=%s)…", current_ts)
        chunks = load_chunks()
        if not chunks:
            logger.warning("[RAG] No data chunks available yet")
            return

        texts = [c["text"] for c in chunks]
        metadatas = [{"source": c["source"]} for c in chunks]
        try:
            embeddings = await embed_texts(texts)
        except Exception as exc:
            logger.error("[RAG] Error generating embeddings: %s", exc)
            return

        self.store.add_all(texts, embeddings, metadatas)
        self.store.save(current_ts)      
        self.store.data_timestamp = current_ts
        logger.info("[RAG] Vectorstore ready with %d chunks", len(chunks))

    _PINNED_SOURCES = [
        "presidential_current",
        "prediction",
        "senate_national_current",
        "parlamento_andino_current",
        "regions_overview",
        "provinces_overview",
    ]

    _EMBED_QUERY_TIMEOUT = 8.0

    async def get_context(self, query: str, k: int = 6) -> str:
        if not self._ready:
            await self.initialize()

        if not self.store.texts:
            return "No electoral data available at this moment."

        pinned = self.store.get_by_sources(self._PINNED_SOURCES)
        pinned_sources = {r["metadata"].get("source") for r in pinned}

        semantic: list[dict] = []
        if self._lock.locked():
            logger.info("[RAG] Rebuild in progress → skipping semantic search, using pinned only")
        else:
            try:
                query_emb = await asyncio.wait_for(
                    embed_text(query), timeout=self._EMBED_QUERY_TIMEOUT
                )
                semantic = self.store.search(query_emb, k=k, exclude_sources=pinned_sources)
            except asyncio.TimeoutError:
                logger.warning("[RAG] Timeout embedding query (%ss) → pinned only", self._EMBED_QUERY_TIMEOUT)
            except Exception as exc:
                logger.warning("[RAG] Semantic search failed (%s) → pinned only", exc)

        all_chunks = pinned + semantic
        logger.debug("[RAG] Context: %d pinned + %d semantic = %d chunks",
                     len(pinned), len(semantic), len(all_chunks))
        return "\n\n---\n\n".join(r["text"] for r in all_chunks)


rag_engine = RAGEngine()

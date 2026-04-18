# Backend

Python 3.12 FastAPI application that scrapes live data from the ONPE API, stores election snapshots to disk, runs Monte Carlo predictions, and serves a streaming LLM chat endpoint backed by a local Ollama instance.

## Structure

```
Backend/
├── main.py           # FastAPI app, CORS, all HTTP routes, LLM SSE endpoint
├── fetcher.py        # Selenium + httpx scraper for ONPE endpoints
├── processor.py      # Normalises raw ONPE responses into snapshot objects
├── scheduler.py      # Background polling thread (every 60 s)
├── storage.py        # Atomic JSON read/write helpers
├── predictor.py      # Monte Carlo simulation (100 000 runs)
├── config.py         # Central configuration: paths, endpoints, election definitions
├── requirements.txt
├── .env.example      # Template for Ollama connection settings
└── AI/
    ├── rag.py         # RAGEngine: vectorstore queries, scheduled rebuild
    ├── data_loader.py # Converts election snapshots to text chunks for indexing
    ├── embeddings.py  # Async embed_text / embed_texts via Ollama
    └── vectorstore.py # In-memory vector store with cosine similarity search
```

## Data Layout

All persistent state lives under `Backend/data/`:

```
data/
├── metadata.json              # Global fetch metadata
├── ai/
│   └── vectorstore.json       # Serialised RAG vectorstore
├── presidential/
│   ├── current.json           # Latest national snapshot
│   ├── prediction.json        # Monte Carlo output
│   ├── timeline.json          # Full time series for charts
│   ├── history/               # Per-acta-pct snapshots (80.561_<ts>.json)
│   └── geographic/
│       ├── regions/           # One file per department UBIGEO (010000.json ...)
│       ├── provinces/         # Cached provincial breakdowns
│       ├── districts/         # Cached district breakdowns
│       └── abroad.json
├── senate_national/
├── senate_regional/
├── deputies/
└── parlamento_andino/
```

Each election key follows the same folder convention. Only `presidential` and `parlamento_andino` accumulate prediction and timeline files.

## Module Responsibilities

### main.py

Configures CORS, defines all routes, manages application lifespan (starts the scheduler and RAG engine at startup). Also enforces an origin allowlist for the `/LLM` endpoint and holds the system prompt for the Bit AI assistant.

### fetcher.py

Manages a Selenium WebDriver singleton (headless Chromium). Provides `fetch_national` and `fetch_geographic` functions with retry logic and exponential backoff. Used by the scheduler and on-demand geographic endpoints.

### processor.py

Converts raw ONPE JSON into clean Python dicts: normalises candidate fields, computes participation rates, and assembles a complete snapshot object via `build_snapshot`.

### scheduler.py

Runs a daemon thread that polls ONPE every 60 seconds (plus up to 15 s of jitter). Snapshots are only written to disk when the actas contabilizadas percentage changes by more than 0.1 % (`MIN_PCT_CHANGE_TO_SAVE`). After each write, it triggers a RAG vectorstore rebuild.

### storage.py

All reads and writes go through this module. Writes are atomic: data is written to a temporary file, then renamed to the target path to avoid partial reads.

### predictor.py

Loads current regional data and runs 100 000 Monte Carlo iterations to estimate the probability that each presidential candidate finishes first or second. Results are written to `data/presidential/prediction.json`.

### AI/rag.py

Maintains a `RAGEngine` that combines semantic search (top-k cosine similarity) with a set of six pinned sources that are always included in the LLM context window. Rebuilds run asynchronously and are debounced to avoid redundant work.

### AI/data_loader.py

Reads election snapshots and formats them into labelled text segments (national totals, regional overviews, timeline summaries, senate results, etc.) suitable for embedding and retrieval.

### AI/vectorstore.py

In-memory store of (text, embedding, source) tuples. Persisted to `data/ai/vectorstore.json` after each rebuild. Provides cosine similarity search and source-based filtering.

## API Endpoints

| Method | Path                                          | Description                            |
|--------|-----------------------------------------------|----------------------------------------|
| GET    | `/`                                           | API status and available elections     |
| GET    | `/status`                                     | Scheduler info and last fetch metadata |
| GET    | `/elections`                                  | List all election keys                 |
| GET    | `/elections/{key}`                            | Current snapshot for an election       |
| GET    | `/elections/{key}/history`                    | All historical snapshots               |
| GET    | `/elections/{key}/timeline`                   | Time-series data for charts            |
| GET    | `/geographic/regions`                         | All regional data                      |
| GET    | `/geographic/regions/{ubigeo}`                | Single region                          |
| GET    | `/geographic/provinces/{ubigeo}`              | Provinces for a department             |
| GET    | `/geographic/districts/{ubigeo}`              | Districts for a province               |
| GET    | `/abroad`                                     | Voting abroad data                     |
| POST   | `/fetch/now`                                  | Trigger an immediate data fetch        |
| POST   | `/LLM`                                        | Streaming SSE chat (origin-guarded)    |

## Environment Variables

Copy `.env.example` to `.env`:

```
OLLAMA_URL=http://192.168.24.10:11434
OLLAMA_LLM_MODEL=gemma4:26b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

The application works without Ollama configured — the `/LLM` endpoint will return errors, but all election data endpoints remain functional.

## Running

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Chromium must be installed and reachable for the Selenium scraper. The Dockerfile installs `chromium` and `chromium-chromedriver` on Alpine automatically.

## Configuration

`config.py` is the single source of truth for:

- `POLL_INTERVAL_SECONDS` (default 60) — scheduler polling frequency
- `MIN_PCT_CHANGE_TO_SAVE` (default 0.001) — minimum actas change to persist a snapshot
- `SELENIUM_HEADLESS`, `SELENIUM_MAX_RETRIES`, `SELENIUM_PAGE_LOAD_WAIT` — scraper behaviour
- Election type definitions and ONPE endpoint templates
- Peruvian department UBIGEO mappings (25 departments + Callao)
